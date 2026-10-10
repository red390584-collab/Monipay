package com.goldltm.app.helper

import android.content.Context
import com.goldltm.app.BuildConfig
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class TermiiHelper(private val context: Context) {

    private val gson: Gson = GsonBuilder().create()

    private val client: OkHttpClient by lazy {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    sealed class SmsResult {
        data class Success(val response: String) : SmsResult()
        data class Error(val message: String) : SmsResult()
    }

    /**
     * Send SMS via Termii API with Sender ID "Goldltm".
     */
    fun sendSms(phoneNumber: String, message: String, callbackId: Int, callback: (SmsResult) -> Unit) {
        if (phoneNumber.isBlank()) {
            callback(SmsResult.Error("Phone number is empty"))
            return
        }
        if (message.isBlank()) {
            callback(SmsResult.Error("Message is empty"))
            return
        }

        val apiKey = SharedPrefsHelper(context).termiiApiKey
            ?.takeIf { it.isNotBlank() }
            ?: BuildConfig.TERMII_API_KEY

        if (apiKey.isBlank()) {
            callback(SmsResult.Error("Termii API key not configured"))
            return
        }

        val senderId = BuildConfig.TERMII_SENDER_ID // "Goldltm"

        val requestBody = JSONObject().apply {
            put("to", formatPhoneNumber(phoneNumber))
            put("from", senderId)
            put("sms", message)
            put("type", "plain")
            put("channel", "generic")
            put("api_key", apiKey)
        }

        val url = BuildConfig.TERMII_BASE_URL.trimEnd('/') + "/api/sms/send"

        val request = Request.Builder()
            .url(url)
            .post(requestBody.toString().toRequestBody("application/json".toMediaType()))
            .addHeader("Accept", "application/json")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(SmsResult.Error("Network error: ${e.message}"))
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        callback(SmsResult.Success(body))
                    } else {
                        val errorMsg = try {
                            JSONObject(body).optString("message", body.ifBlank { "Unknown error" })
                        } catch (e: Exception) {
                            body.ifBlank { "HTTP ${response.code}" }
                        }
                        callback(SmsResult.Error("HTTP ${response.code}: $errorMsg"))
                    }
                } catch (e: Exception) {
                    callback(SmsResult.Error("Error reading response: ${e.message}"))
                }
            }
        })
    }

    /**
     * Derive phone number from account number.
     * Account number format: 019XXXXXXXXXX -> +234XXXXXXXXXX
     */
    fun derivePhoneNumberFromAccount(accountNumber: String): String {
        val cleanNumber = accountNumber.removePrefix("019")
        return "+234$cleanNumber"
    }

    /**
     * Format any phone number to international +234 format.
     */
    fun formatPhoneNumber(phoneNumber: String): String {
        var cleaned = phoneNumber.replace("+", "").replace(" ", "").replace("-", "")
        if (cleaned.startsWith("234")) {
            return "+$cleaned"
        }
        if (cleaned.startsWith("0")) {
            cleaned = cleaned.removePrefix("0")
        }
        return "+234$cleaned"
    }

    /**
     * Build a professional credit alert SMS (Moniepoint-style template).
     */
    fun buildCreditAlertMessage(
        amount: Double,
        senderName: String,
        senderAccount: String,
        transactionType: String,
        availableBalance: Double,
        transactionId: String,
        reference: String,
        date: String,
        time: String
    ): String {
        return buildString {
            appendLine("Credit Alert")
            appendLine()
            appendLine("Amount: ₦${String.format(java.util.Locale.US, "%,.2f", amount)}")
            appendLine("From: $senderName ($senderAccount)")
            appendLine("Date: $date")
            appendLine("Time: $time")
            appendLine("Transaction Type: $transactionType")
            appendLine("Available Balance: ₦${String.format(java.util.Locale.US, "%,.2f", availableBalance)}")
            appendLine("Transaction ID: $transactionId")
            appendLine("Reference: $reference")
            appendLine()
            append("Thank you for using Goldltm.")
        }
    }

    fun parseTermiiResponse(responseJson: String): String? {
        return try {
            JSONObject(responseJson).optString("id", null)
        } catch (e: Exception) {
            null
        }
    }
}
