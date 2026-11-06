package com.fracspace.tooka.call

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ViewManager
import java.lang.ref.WeakReference

/**
 * JS entry point: NativeModules.IncomingCallNotification
 *   show(data)            - ring for a pushed call (data = the INCOMING_CALL push fields)
 *   cancel(callSessionId) - stop ringing
 *   getLaunchAction()     - the Answer/Open tap that launched or resumed the app, once
 * Emits "TookaCallAction" { action, data } when a tap arrives while JS is running.
 */
class IncomingCallModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        current = WeakReference(reactContext)
    }

    override fun getName() = "IncomingCallNotification"

    @ReactMethod
    fun show(data: ReadableMap) {
        IncomingCallNotification.show(reactContext, Arguments.toBundle(data) ?: return)
    }

    @ReactMethod
    fun cancel(callSessionId: String) {
        IncomingCallNotification.cancel(reactContext, callSessionId)
    }

    @ReactMethod
    fun getLaunchAction(promise: Promise) {
        val pending = pendingAction
        pendingAction = null
        if (pending == null) {
            promise.resolve(null)
            return
        }
        promise.resolve(toMap(pending.first, pending.second))
    }

    /** Sync, for the splash: this app start came from Answer/tap on a ringing call. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun wasOpenedForCall(): Boolean = openedForCall

    /** After a call: MainActivity stops showing over the lock screen (set when a call opened it). */
    @ReactMethod
    fun releaseLockScreen() {
        val activity = reactContext.currentActivity ?: return
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            activity.runOnUiThread {
                activity.setShowWhenLocked(false)
                activity.setTurnScreenOn(false)
            }
        }
    }

    /** False on Android 14+ when the user has not allowed full-screen call screens for Tooka. */
    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        promise.resolve(IncomingCallNotification.canUseFullScreen(reactContext))
    }

    /** Opens the system page where the user allows Tooka's full-screen call screen. */
    @ReactMethod
    fun openFullScreenIntentSettings() {
        val intent = if (android.os.Build.VERSION.SDK_INT >= 34) {
            Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                .setData(android.net.Uri.parse("package:${reactContext.packageName}"))
        } else {
            Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
        }
        reactContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Double) = Unit

    companion object {
        private var current: WeakReference<ReactApplicationContext>? = null
        private var pendingAction: Pair<String, Bundle>? = null
        private var openedForCall = false

        private fun toMap(action: String, data: Bundle) = Arguments.createMap().apply {
            putString("action", action)
            putMap("data", Arguments.fromBundle(data))
        }

        /** Sends an action to running JS. Returns false when no JS is there to receive it. */
        fun emitAction(action: String, data: Bundle): Boolean {
            val context = current?.get() ?: return false
            if (!context.hasActiveReactInstance()) return false
            context.emitDeviceEvent("TookaCallAction", toMap(action, data))
            return true
        }

        /** Called by MainActivity for a notification tap (cold start or resume). */
        fun handleIntent(intent: Intent?): Boolean {
            val action = when (intent?.action) {
                IncomingCallNotification.ACTION_ANSWER -> "answer"
                IncomingCallNotification.ACTION_OPEN -> "open"
                else -> return false
            }
            val data = intent.getBundleExtra(IncomingCallNotification.EXTRA_DATA) ?: return false
            // Consume it so a config change or relaunch does not replay it.
            intent.action = null
            // Kept until JS asks for it: the event may fire before any JS listener exists.
            pendingAction = action to data
            openedForCall = true
            emitAction(action, data)
            return true
        }
    }
}

class IncomingCallPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(IncomingCallModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
