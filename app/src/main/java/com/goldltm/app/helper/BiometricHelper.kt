package com.goldltm.app.helper

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Wraps AndroidX Biometric + Android Keystore.
 *
 * All authentication runs through a [BiometricPrompt.CryptoObject] whose key is
 * generated with [KeyGenParameterSpec] + setUserAuthenticationRequired(true)
 * (AES/GCM/NoPadding, per-use auth), so the prompt cannot be bypassed by
 * calling the JavaScript success callback directly — the crypto operation is
 * only unlocked by a real biometric match.
 */
class BiometricHelper(private val activity: FragmentActivity) {

    enum class Availability { AVAILABLE, NO_HARDWARE, HARDWARE_UNAVAILABLE, NOT_ENROLLED, UNAVAILABLE }

    /** Strong biometrics required — CryptoObject keys need class 3 (strong) authenticators. */
    fun availability(): Availability {
        return when (BiometricManager.from(activity)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> Availability.AVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> Availability.NO_HARDWARE
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> Availability.HARDWARE_UNAVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> Availability.NOT_ENROLLED
            else -> Availability.UNAVAILABLE
        }
    }

    /** User-facing message per spec: hardware missing vs. nothing enrolled. */
    fun availabilityMessage(): String = when (availability()) {
        Availability.AVAILABLE -> ""
        Availability.NO_HARDWARE, Availability.HARDWARE_UNAVAILABLE ->
            "Biometric not available on this device"
        Availability.NOT_ENROLLED ->
            "No biometric credentials enrolled. Please set up in device settings."
        Availability.UNAVAILABLE -> "Biometrics unavailable on this device"
    }

    // ------------------------------------------
    // Keystore key management
    // ------------------------------------------

    /** AES/GCM key that only works after a successful biometric authentication. */
    fun getOrCreateKey(alias: String): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
        )
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // Auth required for every use (0 seconds validity)
                    setUserAuthenticationParameters(
                        0, KeyProperties.AUTH_BIOMETRIC_STRONG
                    )
                } else {
                    @Suppress("DEPRECATION")
                    setUserAuthenticationValidityDurationSeconds(-1)
                }
            }
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    fun deleteKey(alias: String) {
        try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
        } catch (e: Exception) {
            // Best-effort cleanup — a missing keystore just means nothing to delete
        }
    }

    fun createEncryptCipher(alias: String): Cipher {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey(alias))
        return cipher
    }

    /**
     * Prepares the decryption cipher for the stored session token.
     * Throws [java.security.KeyPermanentlyInvalidatedException] when the user
     * changed their lock screen or re-enrolled biometrics since enrolment —
     * callers must then disable biometric login and ask the user to re-enable.
     */
    fun createDecryptCipher(alias: String, iv: ByteArray): Cipher {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(alias), GCMParameterSpec(128, iv))
        return cipher
    }

    // ------------------------------------------
    // Prompt execution
    // ------------------------------------------

    fun authenticate(
        title: String,
        subtitle: String,
        negativeText: String,
        cryptoObject: BiometricPrompt.CryptoObject?,
        onSuccess: (BiometricPrompt.CryptoObject?) -> Unit,
        onError: (errorCode: Int, message: String) -> Unit,
        onCancelled: () -> Unit
    ) {
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccess(result.cryptoObject)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    when (errorCode) {
                        BiometricPrompt.ERROR_USER_CANCELED,
                        BiometricPrompt.ERROR_USER_NOT_DETECTED,
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                        BiometricPrompt.ERROR_CANCELED -> onCancelled()
                        else -> onError(errorCode, errString.toString())
                    }
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeText)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        if (cryptoObject != null) {
            prompt.authenticate(promptInfo, cryptoObject)
        } else {
            prompt.authenticate(promptInfo)
        }
    }
}
