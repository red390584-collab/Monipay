package com.goldltm.app.helper

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class SharedPrefsHelper(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    // Keys
    companion object {
        const val PREFS_NAME = "goldltm_prefs"

        // Authentication & Session
        const val KEY_PHONE_NUMBER = "phone_number"
        const val KEY_IS_LOGGED_IN = "is_logged_in"
        const val KEY_USER_ID = "user_id"
        const val KEY_USERNAME = "username"
        const val KEY_USER_EMAIL = "user_email"
        const val KEY_USER_BVN = "user_bvn"
        const val KEY_WALLET_ADDRESS = "wallet_address"
        const val KEY_ACCOUNT_NUMBER = "account_number"
        const val KEY_PIN_HASH = "pin_hash"

        // Theme
        const val KEY_THEME_PREFERENCE = "theme_preference"

        // API Keys
        const val KEY_PAYSTACK_API_KEY = "paystack_api_key"
        const val KEY_TERMII_API_KEY = "termii_api_key"
        const val KEY_JSONBIN_MASTER_KEY = "jsonbin_master_key"
        const val KEY_JSONBIN_BIN_ID = "jsonbin_bin_id"

        // Notifications
        const val KEY_CREDIT_SMS = "credit_sms"
        const val KEY_DEBIT_SMS = "debit_sms"
        const val KEY_PUSH_NOTIFICATIONS = "push_notifications"

        // Biometric
        const val KEY_BIOMETRIC_ENABLED = "biometric_enabled"

        // Onboarding
        const val KEY_ONBOARDING_COMPLETE = "onboarding_complete"

        // Avatar
        const val KEY_AVATAR_URL = "avatar_url"

        // Version tracking
        const val KEY_APP_VERSION = "app_version"
    }

    // String operations
    fun saveString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    fun getString(key: String): String? {
        return prefs.getString(key, null)
    }

    fun getString(key: String, defaultValue: String): String {
        return prefs.getString(key, defaultValue) ?: defaultValue
    }

    // Boolean operations
    fun saveBoolean(key: String, value: Boolean) {
        prefs.edit().putBoolean(key, value).apply()
    }

    fun getBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return prefs.getBoolean(key, defaultValue)
    }

    // Int operations
    fun saveInt(key: String, value: Int) {
        prefs.edit().putInt(key, value).apply()
    }

    fun getInt(key: String, defaultValue: Int = 0): Int {
        return prefs.getInt(key, defaultValue)
    }

    // Long operations
    fun saveLong(key: String, value: Long) {
        prefs.edit().putLong(key, value).apply()
    }

    fun getLong(key: String, defaultValue: Long = 0L): Long {
        return prefs.getLong(key, defaultValue)
    }

    // Object operations (using Gson serialization)
    fun saveObject<T>(key: String, obj: T) {
        val json = gson.toJson(obj)
        prefs.edit().putString(key, json).apply()
    }

    fun <T> getObject(key: String, clazz: Class<T>): T? {
        val json = prefs.getString(key, null) ?: return null
        return try {
            gson.fromJson(json, clazz)
        } catch (e: Exception) {
            null
        }
    }

    fun <T> getObjectList(key: String, type: TypeToken<T>): List<T>? {
        val json = prefs.getString(key, null) ?: return null
        return try {
            gson.fromJson(json, type.type)
        } catch (e: Exception) {
            null
        }
    }

    // Convenience getters/setters for common settings

    var themePreference: String
        get() = getString(KEY_THEME_PREFERENCE, "dark") ?: "dark"
        set(value) = saveString(KEY_THEME_PREFERENCE, value)

    var isLoggedIn: Boolean
        get() = getBoolean(KEY_IS_LOGGED_IN, false)
        set(value) = saveBoolean(KEY_IS_LOGGED_IN, value)

    var phoneNumber: String?
        get() = getString(KEY_PHONE_NUMBER)
        set(value) {
            if (value != null) {
                saveString(KEY_PHONE_NUMBER, value)
            } else {
                prefs.edit().remove(KEY_PHONE_NUMBER).apply()
            }
        }

    var userId: String?
        get() = getString(KEY_USER_ID)
        set(value) {
            if (value != null) {
                saveString(KEY_USER_ID, value)
            } else {
                prefs.edit().remove(KEY_USER_ID).apply()
            }
        }

    var username: String?
        get() = getString(KEY_USERNAME)
        set(value) {
            if (value != null) {
                saveString(KEY_USERNAME, value)
            } else {
                prefs.edit().remove(KEY_USERNAME).apply()
            }
        }

    var userEmail: String?
        get() = getString(KEY_USER_EMAIL)
        set(value) {
            if (value != null) {
                saveString(KEY_USER_EMAIL, value)
            } else {
                prefs.edit().remove(KEY_USER_EMAIL).apply()
            }
        }

    var userBvn: String?
        get() = getString(KEY_USER_BVN)
        set(value) {
            if (value != null) {
                saveString(KEY_USER_BVN, value)
            } else {
                prefs.edit().remove(KEY_USER_BVN).apply()
            }
        }

    var walletAddress: String?
        get() = getString(KEY_WALLET_ADDRESS)
        set(value) {
            if (value != null) {
                saveString(KEY_WALLET_ADDRESS, value)
            } else {
                prefs.edit().remove(KEY_WALLET_ADDRESS).apply()
            }
        }

    var accountNumber: String?
        get() = getString(KEY_ACCOUNT_NUMBER)
        set(value) {
            if (value != null) {
                saveString(KEY_ACCOUNT_NUMBER, value)
            } else {
                prefs.edit().remove(KEY_ACCOUNT_NUMBER).apply()
            }
        }

    var paystackApiKey: String?
        get() = getString(KEY_PAYSTACK_API_KEY)
        set(value) {
            if (value != null) {
                saveString(KEY_PAYSTACK_API_KEY, value)
            } else {
                prefs.edit().remove(KEY_PAYSTACK_API_KEY).apply()
            }
        }

    var termiiApiKey: String?
        get() = getString(KEY_TERMII_API_KEY)
        set(value) {
            if (value != null) {
                saveString(KEY_TERMII_API_KEY, value)
            } else {
                prefs.edit().remove(KEY_TERMII_API_KEY).apply()
            }
        }

    var jsonbinMasterKey: String?
        get() = getString(KEY_JSONBIN_MASTER_KEY)
        set(value) {
            if (value != null) {
                saveString(KEY_JSONBIN_MASTER_KEY, value)
            } else {
                prefs.edit().remove(KEY_JSONBIN_MASTER_KEY).apply()
            }
        }

    var creditSmsEnabled: Boolean
        get() = getBoolean(KEY_CREDIT_SMS, true)
        set(value) = saveBoolean(KEY_CREDIT_SMS, value)

    var debitSmsEnabled: Boolean
        get() = getBoolean(KEY_DEBIT_SMS, true)
        set(value) = saveBoolean(KEY_DEBIT_SMS, value)

    var pushNotificationsEnabled: Boolean
        get() = getBoolean(KEY_PUSH_NOTIFICATIONS, true)
        set(value) = saveBoolean(KEY_PUSH_NOTIFICATIONS, value)

    var biometricEnabled: Boolean
        get() = getBoolean(KEY_BIOMETRIC_ENABLED, false)
        set(value) = saveBoolean(KEY_BIOMETRIC_ENABLED, value)

    var onboardingComplete: Boolean
        get() = getBoolean(KEY_ONBOARDING_COMPLETE, false)
        set(value) = saveBoolean(KEY_ONBOARDING_COMPLETE, value)

    var avatarUrl: String?
        get() = getString(KEY_AVATAR_URL)
        set(value) {
            if (value != null) {
                saveString(KEY_AVATAR_URL, value)
            } else {
                prefs.edit().remove(KEY_AVATAR_URL).apply()
            }
        }

    // Clear operations
    fun removeKey(key: String) {
        prefs.edit().remove(key).apply()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    // Get all preferences as a map (for debugging/JS bridge)
    fun getAllPreferences(): Map<String, Any?> {
        val all = prefs.all
        return all.mapValues { (_, value) ->
            when (value) {
                is String -> value
                is Int -> value
                is Long -> value
                is Float -> value
                is Boolean -> value
                is Set<*> -> value.joinToString(",") { it.toString() }
                null -> null
                else -> value.toString()
            }
        }
    }

    // Check if key exists
    fun contains(key: String): Boolean {
        return prefs.contains(key)
    }

}
