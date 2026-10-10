package com.goldltm.app.helper

import com.goldltm.app.BuildConfig
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.annotations.SerializedName
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

class ApiClient(private val context: android.content.Context) {

    private val gson: Gson = GsonBuilder().create()

    private val okHttpClient: OkHttpClient by lazy {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                    else HttpLoggingInterceptor.Level.NONE
        }
        OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl("https://api.paystack.co/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    private val paystackApi: PaystackApiService by lazy {
        retrofit.create(PaystackApiService::class.java)
    }

    fun resolveBank(
        bankCode: String,
        accountNumber: String,
        apiKey: String,
        callback: (BankResult) -> Unit
    ) {
        val call = paystackApi.resolveAccount(
            accountNumber = accountNumber,
            bankCode = bankCode,
            auth = "Bearer $apiKey"
        )

        call.enqueue(object : Callback<PaystackResolveResponse> {
            override fun onResponse(
                call: Call<PaystackResolveResponse>,
                response: Response<PaystackResolveResponse>
            ) {
                val body = response.body()
                if (response.isSuccessful && body != null && body.status == true) {
                    val data = body.data
                    val accountName = data?.accountName ?: "Unknown"
                    val resultJson = gson.toJson(
                        mapOf(
                            "status" to "success",
                            "data" to mapOf(
                                "account_number" to (data?.accountNumber ?: accountNumber),
                                "account_name" to accountName,
                                "bank_code" to bankCode
                            )
                        )
                    )
                    callback(BankResult.Success(resultJson))
                } else {
                    callback(BankResult.Error("Bank resolution failed: HTTP ${response.code()}"))
                }
            }

            override fun onFailure(call: Call<PaystackResolveResponse>, t: Throwable) {
                callback(BankResult.Error("Network error: ${t.message}"))
            }
        })
    }

    fun getNigerianBanks(apiKey: String, callback: (List<Bank>) -> Unit) {
        if (apiKey.isBlank()) {
            callback(defaultBanks())
            return
        }

        val call = paystackApi.getBanks(currency = "NGN", auth = "Bearer $apiKey")
        call.enqueue(object : Callback<PaystackBanksResponse> {
            override fun onResponse(
                call: Call<PaystackBanksResponse>,
                response: Response<PaystackBanksResponse>
            ) {
                val body = response.body()
                if (response.isSuccessful && body != null && body.status == true && !body.data.isNullOrEmpty()) {
                    callback(body.data)
                } else {
                    callback(defaultBanks())
                }
            }

            override fun onFailure(call: Call<PaystackBanksResponse>, t: Throwable) {
                callback(defaultBanks())
            }
        })
    }

    private fun defaultBanks(): List<Bank> {
        // Correct Paystack bank codes. Mobile banks (OPay, PalmPay, Kuda, Moniepoint)
        // use phone-number accounts; the JS layer flags them for SMS credit alerts.
        return listOf(
            // Codes verified live against Paystack /bank?currency=NGN
            Bank(name = "OPay Digital Services (OPay)", code = "999992"),
            Bank(name = "PalmPay", code = "999991"),
            Bank(name = "Kuda Bank", code = "50211"),
            Bank(name = "Moniepoint MFB", code = "50515"),
            Bank(name = "Eyowo", code = "50126"),
            Bank(name = "Paga", code = "100002"),
            Bank(name = "Access Bank", code = "044"),
            Bank(name = "Zenith Bank", code = "057"),
            Bank(name = "GTBank", code = "058"),
            Bank(name = "First Bank of Nigeria", code = "011"),
            Bank(name = "UBA", code = "033"),
            Bank(name = "Union Bank of Nigeria", code = "032"),
            Bank(name = "Sterling Bank", code = "232"),
            Bank(name = "Wema Bank", code = "035"),
            Bank(name = "Fidelity Bank", code = "070"),
            Bank(name = "FCMB", code = "214"),
            Bank(name = "Stanbic IBTC Bank", code = "221"),
            Bank(name = "Keystone Bank", code = "082"),
            Bank(name = "Polaris Bank", code = "076"),
            Bank(name = "Providus Bank", code = "101"),
            Bank(name = "Jaiz Bank", code = "301"),
            Bank(name = "Unity Bank", code = "215"),
            Bank(name = "Ecobank Nigeria", code = "050")
        )
    }

    interface PaystackApiService {
        // Paystack account-name resolution: GET https://api.paystack.co/bank/resolve
        @GET("bank/resolve")
        fun resolveAccount(
            @Query("account_number") accountNumber: String,
            @Query("bank_code") bankCode: String,
            @Header("Authorization") auth: String
        ): Call<PaystackResolveResponse>

        // NGN bank list: GET https://api.paystack.co/bank?currency=NGN
        @GET("bank")
        fun getBanks(
            @Query("currency") currency: String,
            @Header("Authorization") auth: String
        ): Call<PaystackBanksResponse>
    }

    data class PaystackResolveResponse(
        val status: Boolean?,
        val message: String?,
        val data: PaystackResolveData?
    )

    data class PaystackResolveData(
        @SerializedName("account_number")
        val accountNumber: String?,
        @SerializedName("account_name")
        val accountName: String?
    )

    data class PaystackBanksResponse(
        val status: Boolean?,
        val message: String?,
        val data: List<Bank>?
    )

    data class Bank(
        val name: String,
        val code: String,
        val slug: String? = null
    )

    sealed class BankResult {
        data class Success(val json: String) : BankResult()
        data class Error(val message: String) : BankResult()
    }
}
