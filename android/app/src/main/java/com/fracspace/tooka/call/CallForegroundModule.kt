package com.fracspace.tooka.call

import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/** JS entry point: NativeModules.CallForegroundService.start(title, text) / stop(). */
class CallForegroundModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "CallForegroundService"

    @ReactMethod
    fun start(title: String, text: String) {
        val intent = Intent(reactContext, CallForegroundService::class.java)
            .putExtra(CallForegroundService.EXTRA_TITLE, title)
            .putExtra(CallForegroundService.EXTRA_TEXT, text)
        try {
            ContextCompat.startForegroundService(reactContext, intent)
        } catch (e: Exception) {
            // Android 12+ refuses to start one while the app is in the background.
            Log.w("CallForegroundService", "start failed", e)
        }
    }

    @ReactMethod
    fun stop() {
        try {
            reactContext.stopService(Intent(reactContext, CallForegroundService::class.java))
        } catch (e: Exception) {
            Log.w("CallForegroundService", "stop failed", e)
        }
    }
}

class CallForegroundPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(CallForegroundModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
