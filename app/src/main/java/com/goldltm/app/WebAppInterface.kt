package com.goldltm.app

import android.content.ContentValues
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.biometric.BiometricManager
import androidx.core.content.FileProvider
import com.goldltm.app.helper.ApiClient
import com.goldltm.app.helper.JsonBinHelper
import com.goldltm.app.helper.SharedPrefsHelper
import com.goldltm.app.helper.TermiiHelper
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class WebAppInterface(private val activity: MainActivity) {

    private val gson: Gson = GsonBuilder().create()
    private val sharedPrefsHelper = SharedPrefsHelper(activity)
    private val jsonBinHelper = JsonBinHelper(activity)
    private val termiiHelper = TermiiHelper(activity)
    private val apiClient = ApiClient(activity)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var webView: WebView? = null
    private var transactionCounter = 0L

    fun attachWebView(webView: WebView) {
        this.webView = webView
    }

    // ------------------------------------------
    // Preferences
    // ------------------------------------------

    @JavascriptInterface
    fun savePreference(key: String, value: String) {
        sharedPrefsHelper.saveString(key, value)
    }

    @JavascriptInterface
    fun getPreference(key: String): String {
        return sharedPrefsHelper.getString(key) ?: ""
    }

    @JavascriptInterface
    fun getPreferencesAsJson(): String {
        return gson.toJson(sharedPrefsHelper.getAllPreferences())
    }

    @JavascriptInterface
    fun clearPreference(key: String) {
        sharedPrefsHelper.removeKey(key)
    }

    @JavascriptInterface
    fun clearAllPreferences() {
        sharedPrefsHelper.clearAll()
    }

    // ------------------------------------------
    // Paystack bank name resolution
    // ------------------------------------------

    @JavascriptInterface
    fun fetchBankName(bankCode: String, accountNumber: String, apiKey: String, callbackId: Int) {
        val resolvedKey = if (apiKey.isBlank()) {
            sharedPrefsHelper.getString(SharedPrefsHelper.KEY_PAYSTACK_API_KEY) ?: ""
        } else {
            apiKey
        }

        if (resolvedKey.isBlank()) {
            // No API key: tell the user instead of inventing a recipient name
            sendCallback(callbackId, "bank_name_error", "Paystack API key not set. Add it in Settings → Paystack API Key.")
            return
        }

        apiClient.resolveBank(bankCode, accountNumber, resolvedKey) { result ->
            when (result) {
                is ApiClient.BankResult.Success -> sendCallback(callbackId, "bank_name", result.json)
                is ApiClient.BankResult.Error ->
                    sendCallback(callbackId, "bank_name_error", result.message)
            }
        }
    }

    @JavascriptInterface
    fun getBankList(callbackId: Int) {
        val apiKey = sharedPrefsHelper.getString(SharedPrefsHelper.KEY_PAYSTACK_API_KEY) ?: ""
        apiClient.getNigerianBanks(apiKey) { banks ->
            sendCallback(callbackId, "bank_list", gson.toJson(banks))
        }
    }

    // ------------------------------------------
    // JSON Bin
    // ------------------------------------------

    @JavascriptInterface
    fun getJsonBin(binId: String, callbackId: Int) {
        val resolvedBinId = if (binId.isBlank()) BuildConfig.JSONBIN_BIN_ID else binId
        val masterKey = sharedPrefsHelper.getString(SharedPrefsHelper.KEY_JSONBIN_MASTER_KEY) ?: BuildConfig.JSONBIN_MASTER_KEY

        jsonBinHelper.getBin(resolvedBinId, masterKey) { result ->
            when (result) {
                is JsonBinHelper.Result.Success ->
                    sendCallback(callbackId, "jsonbin_data", result.json)
                is JsonBinHelper.Result.Error ->
                    sendCallback(callbackId, "jsonbin_error", gson.toJson(mapOf("error" to result.message, "code" to result.code)))
            }
        }
    }

    @JavascriptInterface
    fun updateJsonBin(binId: String, jsonData: String, callbackId: Int) {
        val resolvedBinId = if (binId.isBlank()) BuildConfig.JSONBIN_BIN_ID else binId
        val masterKey = sharedPrefsHelper.getString(SharedPrefsHelper.KEY_JSONBIN_MASTER_KEY) ?: BuildConfig.JSONBIN_MASTER_KEY

        jsonBinHelper.updateBin(resolvedBinId, masterKey, jsonData) { result ->
            when (result) {
                is JsonBinHelper.Result.Success ->
                    sendCallback(callbackId, "jsonbin_update", gson.toJson(mapOf("success" to true, "data" to result.json)))
                is JsonBinHelper.Result.Error ->
                    sendCallback(callbackId, "jsonbin_error", gson.toJson(mapOf("error" to result.message, "code" to result.code)))
            }
        }
    }

    // ------------------------------------------
    // Termii SMS
    // ------------------------------------------

    @JavascriptInterface
    fun sendCreditSms(phoneNumber: String, message: String, callbackId: Int) {
        termiiHelper.sendSms(phoneNumber, message, callbackId) { result ->
            when (result) {
                is TermiiHelper.SmsResult.Success ->
                    sendCallback(callbackId, "sms_sent", gson.toJson(mapOf("success" to true, "response" to result.response)))
                is TermiiHelper.SmsResult.Error ->
                    sendCallback(callbackId, "sms_error", gson.toJson(mapOf("error" to result.message)))
            }
        }
    }

    // ------------------------------------------
    // Receipt image export (share sheet / gallery)
    // ------------------------------------------

    @JavascriptInterface
    fun shareReceiptImage(base64Png: String, callbackId: Int) {
        val file = receiptPngFile(base64Png)
        if (file == null) {
            sendCallback(callbackId, "image_error", gson.toJson(mapOf("error" to "Could not render image")))
            return
        }
        mainHandler.post {
            try {
                val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(Intent.createChooser(intent, "Share receipt"))
                sendCallback(callbackId, "image_shared", "{}")
            } catch (e: Exception) {
                sendCallback(callbackId, "image_error", gson.toJson(mapOf("error" to (e.message ?: "Share failed"))))
            }
        }
    }

    @JavascriptInterface
    fun saveReceiptImage(base64Png: String, callbackId: Int) {
        val name = "Goldltm_Receipt_${System.currentTimeMillis()}.png"
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val bytes = decodePng(base64Png)
                    ?: throw IllegalStateException("Could not decode image")
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, name)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Goldltm")
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
                val uri = activity.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Could not create media entry")
                activity.contentResolver.openOutputStream(uri).use { out ->
                    if (out == null) throw IllegalStateException("Could not open stream")
                    out.write(bytes)
                }
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                activity.contentResolver.update(uri, values, null, null)
                sendCallback(callbackId, "image_saved", gson.toJson(mapOf("path" to (Environment.DIRECTORY_PICTURES + "/Goldltm"))))
            } else {
                // Pre-Android 10: this app holds no storage permission, so the file
                // goes to app cache and the user exports it via the share sheet.
                val file = receiptPngFile(base64Png)
                    ?: throw IllegalStateException("Could not write file")
                sendCallback(callbackId, "image_saved", gson.toJson(mapOf("path" to file.absolutePath)))
            }
        } catch (e: Exception) {
            sendCallback(callbackId, "image_error", gson.toJson(mapOf("error" to (e.message ?: "Save failed"))))
        }
    }

    private fun decodePng(base64Png: String): ByteArray? {
        return try {
            val clean = base64Png.substringAfter("base64,", base64Png)
            Base64.decode(clean, Base64.DEFAULT)
        } catch (e: Exception) {
            null
        }
    }

    private fun receiptPngFile(base64Png: String): File? {
        val bytes = decodePng(base64Png) ?: return null
        return try {
            val dir = File(activity.cacheDir, "receipts")
            dir.mkdirs()
            val file = File(dir, "receipt_${System.currentTimeMillis()}.png")
            file.writeBytes(bytes)
            file
        } catch (e: Exception) {
            null
        }
    }

    // ------------------------------------------
    // Camera / Gallery
    // ------------------------------------------

    @JavascriptInterface
    fun launchCamera(callbackId: Int) {
        mainHandler.post { activity.launchCamera(callbackId) }
    }

    @JavascriptInterface
    fun launchGallery(callbackId: Int) {
        mainHandler.post { activity.launchGallery(callbackId) }
    }

    fun dispatchImageCallback(callbackId: Int, base64: String?, source: String) {
        if (callbackId < 0) return
        val data = JSONObject().apply {
            put("source", source)
            put("base64", base64 ?: JSONObject.NULL)
        }
        sendCallback(callbackId, "image_result", data.toString())
    }

    // ------------------------------------------
    // Device info
    // ------------------------------------------

    @JavascriptInterface
    fun getDeviceInfo(): String {
        return JSONObject().apply {
            put("manufacturer", Build.MANUFACTURER)
            put("model", Build.MODEL)
            put("device", Build.DEVICE)
            put("brand", Build.BRAND)
            put("osVersion", "Android ${Build.VERSION.SDK_INT}")
            put("sdkInt", Build.VERSION.SDK_INT)
        }.toString()
    }

    @JavascriptInterface
    fun isBiometricAvailable(): String {
        val biometricManager = BiometricManager.from(activity)
        val status = when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)) {
            BiometricManager.BIOMETRIC_SUCCESS -> "available"
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "no_hardware"
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "hardware_unavailable"
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "not_enrolled"
            else -> "unavailable"
        }
        return JSONObject().apply {
            put("available", status == "available")
            put("status", status)
        }.toString()
    }

    // ------------------------------------------
    // PIN hashing / encryption
    // ------------------------------------------

    @JavascriptInterface
    fun hashPin(pin: String): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(pin.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(hashBytes, Base64.NO_WRAP)
    }

    @JavascriptInterface
    fun verifyPinHash(pin: String, storedHash: String): Boolean {
        return hashPin(pin) == storedHash
    }

    @JavascriptInterface
    fun encryptPin(pin: String): String {
        return try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)

            val keyAlias = "goldltm_pin_key"
            if (!keyStore.containsAlias(keyAlias)) {
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
                )
                val keySpec = KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setUserAuthenticationRequired(false)
                    .build()
                keyGenerator.init(keySpec)
                keyGenerator.generateKey()
            }

            val secretKey = keyStore.getKey(keyAlias, null) as SecretKey
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)

            val iv = cipher.iv
            val encryptedBytes = cipher.doFinal(pin.toByteArray(Charsets.UTF_8))

            JSONObject().apply {
                put("encrypted", Base64.encodeToString(encryptedBytes, Base64.NO_WRAP))
                put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            }.toString()
        } catch (e: Exception) {
            gson.toJson(mapOf("error" to (e.message ?: "encryption failed")))
        }
    }

    // ------------------------------------------
    // Generators & config
    // ------------------------------------------

    @JavascriptInterface
    fun generateWalletAddress(): String = "GL_${UUID.randomUUID()}"

    @JavascriptInterface
    fun generateAccountNumber(phoneNumber: String): String = "019$phoneNumber"

    @JavascriptInterface
    fun generateTransactionId(): String {
        transactionCounter++
        return "TXN_${System.currentTimeMillis()}_$transactionCounter"
    }

    @JavascriptInterface
    fun generateReference(): String {
        val sdf = java.text.SimpleDateFormat("yyyyMMdd_HHmmss", java.util.Locale.US)
        return "REF_${sdf.format(java.util.Date())}"
    }

    @JavascriptInterface
    fun generateReceiptNo(): String {
        val timestamp = System.currentTimeMillis()
        return String.format(java.util.Locale.US, "%010d", timestamp % 10000000000L)
    }

    @JavascriptInterface
    fun getAppVersion(): String = BuildConfig.APP_VERSION

    @JavascriptInterface
    fun getSenderId(): String = BuildConfig.TERMII_SENDER_ID

    @JavascriptInterface
    fun getBinId(): String = BuildConfig.JSONBIN_BIN_ID

    @JavascriptInterface
    fun getTermiiBase(): String = BuildConfig.TERMII_BASE_URL

    @JavascriptInterface
    fun shareText(text: String) {
        mainHandler.post { activity.shareReceiptText(text) }
    }

    @JavascriptInterface
    fun showToast(message: String, isError: Boolean) {
        mainHandler.post { activity.showToast(message, isError) }
    }

    // ------------------------------------------
    // JS callback dispatch
    // ------------------------------------------

    private fun sendCallback(callbackId: Int, channel: String, data: String) {
        val safeData = data
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "")
        val js = "window.__goldDispatch && window.__goldDispatch($callbackId, '$channel', '$safeData');"
        mainHandler.post {
            webView?.evaluateJavascript(js, null)
        }
    }
}
