package com.goldltm.app

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.goldltm.app.databinding.ActivityMainBinding
import com.google.android.material.snackbar.Snackbar
import java.io.ByteArrayOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    lateinit var webAppInterface: WebAppInterface

    private var pendingImageCallbackId: Int = -1
    private var pendingImageSource: String = "gallery"

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            dispatchImageResult(bitmap, "camera")
        } else {
            webAppInterface.dispatchImageCallback(pendingImageCallbackId, null, "camera")
        }
    }

    private val galleryLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            val inputStream = contentResolver.openInputStream(uri)
            val bitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()
            if (bitmap != null) {
                dispatchImageResult(bitmap, "gallery")
            } else {
                webAppInterface.dispatchImageCallback(pendingImageCallbackId, null, "gallery")
            }
        } else {
            webAppInterface.dispatchImageCallback(pendingImageCallbackId, null, "gallery")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        webAppInterface = WebAppInterface(this)

        setupWebView()
        binding.webView.loadUrl("file:///android_asset/index.html")
    }

    private fun setupWebView() {
        val webView = binding.webView
        val settings: WebSettings = webView.settings

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.setSupportZoom(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

        webView.webViewClient = WebViewClient()

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                binding.progressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
            }
        }

        webView.addJavascriptInterface(webAppInterface, "Android")
        webAppInterface.attachWebView(webView)

        webView.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_DOWN) {
                if (webView.canGoBack()) {
                    webView.goBack()
                    return@setOnKeyListener true
                }
            }
            false
        }
    }

    fun launchCamera(callbackId: Int) {
        pendingImageCallbackId = callbackId
        pendingImageSource = "camera"
        try {
            cameraLauncher.launch(null)
        } catch (e: Exception) {
            webAppInterface.dispatchImageCallback(callbackId, null, "camera")
        }
    }

    fun launchGallery(callbackId: Int) {
        pendingImageCallbackId = callbackId
        pendingImageSource = "gallery"
        try {
            galleryLauncher.launch("image/*")
        } catch (e: Exception) {
            webAppInterface.dispatchImageCallback(callbackId, null, "gallery")
        }
    }

    private fun dispatchImageResult(bitmap: Bitmap, source: String) {
        val scaled = scaleBitmap(bitmap, 800)
        val outputStream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
        val base64 = android.util.Base64.encodeToString(outputStream.toByteArray(), android.util.Base64.NO_WRAP)
        if (scaled != bitmap) scaled.recycle()
        webAppInterface.dispatchImageCallback(pendingImageCallbackId, base64, source)
    }

    private fun scaleBitmap(bitmap: Bitmap, maxDimension: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        if (width <= maxDimension && height <= maxDimension) return bitmap

        val ratio = minOf(maxDimension.toFloat() / width, maxDimension.toFloat() / height)
        val newWidth = (width * ratio).toInt().coerceAtLeast(1)
        val newHeight = (height * ratio).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }

    fun shareReceiptText(receiptText: String) {
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Goldltm Transaction Receipt")
            putExtra(Intent.EXTRA_TEXT, receiptText)
        }
        startActivity(Intent.createChooser(shareIntent, getString(R.string.share_receipt)))
    }

    fun showToast(message: String, isError: Boolean = false) {
        Snackbar.make(binding.root, message, Snackbar.LENGTH_LONG)
            .setBackgroundTint(getColor(if (isError) R.color.error else R.color.success))
            .show()
    }

    override fun onBackPressed() {
        val webView = binding.webView
        if (webView.visibility == View.VISIBLE && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
