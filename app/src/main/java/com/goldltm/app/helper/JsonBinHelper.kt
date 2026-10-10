package com.goldltm.app.helper

import android.content.Context
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class JsonBinHelper(private val context: Context) {

    private val gson: Gson = GsonBuilder().create()

    private val client: OkHttpClient by lazy {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    sealed class Result {
        data class Success(val json: String, val httpCode: Int = 200) : Result()
        data class Error(val message: String, val code: Int = 0) : Result()
    }

    /**
     * GET the current bin contents
     */
    fun getBin(binId: String, masterKey: String, callback: (Result) -> Unit) {
        if (binId.isBlank()) {
            callback(Result.Error("Bin ID is empty"))
            return
        }

        val url = "https://api.jsonbin.io/v3/b/$binId"

        val request = Request.Builder()
            .url(url)
            .get()
            .addHeader("Accept", "application/json")
            .addHeader("Content-Type", "application/json")
            .addHeader("X-Master-Key", masterKey)
            .addHeader("X-Bin-Meta", "false")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(Result.Error("Network error: ${e.message}"))
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.string() ?: ""
                    val httpCode = response.code

                    if (response.isSuccessful) {
                        callback(Result.Success(body, httpCode))
                    } else {
                        // Try to extract error message from JSON
                        val errorMsg = try {
                            JSONObject(body).optString("message", "Unknown error")
                        } catch (e: Exception) {
                            body
                        }
                        callback(Result.Error(errorMsg, httpCode))
                    }
                } catch (e: Exception) {
                    callback(Result.Error("Error reading response: ${e.message}"))
                }
            }
        })
    }

    /**
     * PUT updated bin contents
     *
     * @param binId The bin ID
     * @param masterKey The master key (or latest access token)
     * @param jsonData The full JSON data to update
     * @param callback Result callback
     */
    fun updateBin(binId: String, masterKey: String, jsonData: String, callback: (Result) -> Unit) {
        if (binId.isBlank()) {
            callback(Result.Error("Bin ID is empty"))
            return
        }

        if (jsonData.isBlank()) {
            callback(Result.Error("JSON data is empty"))
            return
        }

        // Validate JSON
        try {
            JSONObject(jsonData)
        } catch (e: Exception) {
            callback(Result.Error("Invalid JSON: ${e.message}"))
            return
        }

        val url = "https://api.jsonbin.io/v3/b/$binId"

        val request = Request.Builder()
            .url(url)
            .put(jsonData.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .addHeader("Accept", "application/json")
            .addHeader("Content-Type", "application/json")
            .addHeader("X-Master-Key", masterKey)
            .addHeader("X-Bin-Meta", "false")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(Result.Error("Network error: ${e.message}"))
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.string() ?: ""
                    val httpCode = response.code

                    if (response.isSuccessful) {
                        callback(Result.Success(body, httpCode))
                    } else {
                        val errorMsg = try {
                            JSONObject(body).optString("message", "Unknown error")
                        } catch (e: Exception) {
                            body
                        }
                        callback(Result.Error(errorMsg, httpCode))
                    }
                } catch (e: Exception) {
                    callback(Result.Error("Error reading response: ${e.message}"))
                }
            }
        })
    }

    /**
     * Create a new bin (if needed)
     */
    fun createBin(masterKey: String, jsonData: String, callback: (Result) -> Unit) {
        if (jsonData.isBlank()) {
            callback(Result.Error("JSON data is empty"))
            return
        }

        val url = "https://api.jsonbin.io/v3/b"

        val request = Request.Builder()
            .url(url)
            .post(jsonData.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .addHeader("Accept", "application/json")
            .addHeader("Content-Type", "application/json")
            .addHeader("X-Master-Key", masterKey)
            .addHeader("X-Bin-Meta", "false")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(Result.Error("Network error: ${e.message}"))
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.string() ?: ""
                    val httpCode = response.code

                    if (response.isSuccessful) {
                        callback(Result.Success(body, httpCode))
                    } else {
                        val errorMsg = try {
                            JSONObject(body).optString("message", "Unknown error")
                        } catch (e: Exception) {
                            body
                        }
                        callback(Result.Error(errorMsg, httpCode))
                    }
                } catch (e: Exception) {
                    callback(Result.Error("Error reading response: ${e.message}"))
                }
            }
        })
    }

    /**
     * Delete a bin
     */
    fun deleteBin(binId: String, masterKey: String, callback: (Result) -> Unit) {
        if (binId.isBlank()) {
            callback(Result.Error("Bin ID is empty"))
            return
        }

        val url = "https://api.jsonbin.io/v3/b/$binId"

        val request = Request.Builder()
            .url(url)
            .delete()
            .addHeader("Accept", "application/json")
            .addHeader("Content-Type", "application/json")
            .addHeader("X-Master-Key", masterKey)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(Result.Error("Network error: ${e.message}"))
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.string() ?: ""
                    val httpCode = response.code

                    if (response.isSuccessful) {
                        callback(Result.Success(body, httpCode))
                    } else {
                        val errorMsg = try {
                            JSONObject(body).optString("message", "Unknown error")
                        } catch (e: Exception) {
                            body
                        }
                        callback(Result.Error(errorMsg, httpCode))
                    }
                } catch (e: Exception) {
                    callback(Result.Error("Error reading response: ${e.message}"))
                }
            }
        })
    }

    /**
     * Simple helpers for common operations
     */

    /**
     * Create a new user record as JSON object
     */
    fun createUserJson(
        phoneNumber: String,
        email: String,
        passwordHash: String,
        pinHash: String,
        fullName: String = "",
        bvn: String = ""
    ): String {
        val walletAddress = "GL_${java.util.UUID.randomUUID()}"
        val accountNumber = "019$phoneNumber"
        val createdAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
            .format(java.util.Date())

        val userJson = JSONObject().apply {
            put("accountNumber", accountNumber)
            put("phoneNumber", phoneNumber)
            put("email", email)
            put("fullName", fullName)
            put("passwordHash", passwordHash)
            put("pinHash", pinHash)
            put("walletAddress", walletAddress)
            put("balance", 5000000.00)
            put("bvn", bvn.ifEmpty { "00000000000" })
            put("avatarUrl", "")
            put("createdAt", createdAt)
            put("biometricEnabled", false)
            put("themePreference", "dark")
            put("paystackApiKey", "")
            put("notifications", JSONObject().apply {
                put("creditSms", true)
                put("debitSms", true)
                put("push", true)
            })
            put("transactions", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "TXN_${System.currentTimeMillis()}")
                    put("type", "credit")
                    put("amount", 5000000.00)
                    put("description", "Welcome Bonus")
                    put("senderName", "Goldltm")
                    put("senderAccount", "SYSTEM")
                    put("balanceAfter", 5000000.00)
                    put("timestamp", createdAt)
                    put("status", "successful")
                })
            })
            put("beneficiaries", JSONArray())
        }

        return userJson.toString()
    }

    /**
     * Parse user data from JSON bin response
     */
    fun parseAllUsers(json: String): Map<String, JSONObject> {
        val result = mutableMapOf<String, JSONObject>()

        try {
            val root = JSONObject(json)
            val users = root.optJSONObject("users")
            if (users != null) {
                val keys = users.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    result[key] = users.getJSONObject(key)
                }
            }
        } catch (e: Exception) {
            // Not a valid structure
        }

        return result
    }

    /**
     * Find user by phone number
     */
    fun findUserByPhone(json: String, phoneNumber: String): JSONObject? {
        val users = parseAllUsers(json)
        for ((_, user) in users) {
            if (user.optString("phoneNumber") == phoneNumber) {
                return user
            }
        }
        return null
    }

    /**
     * Build updated users map from existing data, replacing one user
     */
    fun updateUserInBin(existingJson: String, updatedUserJson: String, phoneNumber: String): String {
        return try {
            val root = JSONObject(existingJson)
            val users = root.optJSONObject("users") ?: JSONObject()
            val meta = root.optJSONObject("meta") ?: JSONObject()

            // Parse the updated user
            val updatedUser = JSONObject(updatedUserJson)

            // Remove old user with same phone, add updated
            val keysToRemove = mutableListOf<String>()
            val keys = users.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val user = users.getJSONObject(key)
                if (user.optString("phoneNumber") == phoneNumber) {
                    keysToRemove.add(key)
                }
            }
            keysToRemove.forEach { users.remove(it) }

            // Add back with account number as key
            val accountNumber = updatedUser.optString("accountNumber")
            users.put(accountNumber, updatedUser)

            // Update meta
            meta.put("lastUpdated", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
                .format(java.util.Date()))
            meta.put("totalUsers", users.length())

            // Build final JSON
            JSONObject().apply {
                put("users", users)
                put("meta", meta)
            }.toString()
        } catch (e: Exception) {
            // If parsing fails, just wrap the user in a simple structure
            JSONObject().apply {
                put("users", JSONObject().apply {
                    put("019$phoneNumber", JSONObject(updatedUserJson))
                })
                put("meta", JSONObject().apply {
                    put("lastUpdated", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
                        .format(java.util.Date()))
                    put("totalUsers", 1)
                    put("appVersion", "1.0.0")
                })
            }.toString()
        }
    }
}
