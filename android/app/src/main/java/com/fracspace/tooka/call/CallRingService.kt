package com.fracspace.tooka.call

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Keeps the app alive while a call push rings with Tooka in the background or closed,
 * so CallRinger can play, vibrate and catch the volume / lock buttons. Runs only while
 * the call rings, as a "phone call" foreground service showing the call notification.
 */
class CallRingService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val callSessionId = intent?.getStringExtra(EXTRA_ID)
        val notification = callSessionId?.let { IncomingCallNotification.notificationFor(it) }
        if (callSessionId == null || notification == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    IncomingCallNotification.notificationId(callSessionId),
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL,
                )
            } else {
                startForeground(IncomingCallNotification.notificationId(callSessionId), notification)
            }
        } catch (e: Exception) {
            // Not allowed to run in the foreground right now: ring anyway while the
            // process lives; the notification is already showing.
        }
        CallRinger.start(this, callSessionId)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        CallRinger.stop()
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_ID = "callSessionId"

        fun start(context: Context, callSessionId: String) {
            val intent = Intent(context, CallRingService::class.java).putExtra(EXTRA_ID, callSessionId)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                // Background start refused: still ring in this process.
                CallRinger.start(context, callSessionId)
            }
        }

        fun stop(context: Context) {
            try {
                context.stopService(Intent(context, CallRingService::class.java))
            } catch (e: Exception) {
                // not running
            }
        }
    }
}
