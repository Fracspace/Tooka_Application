package com.fracspace.tooka.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

/**
 * Decline on the ringing notification. Stops the ring at once, then runs the
 * "TookaCallAction" headless JS task to POST the reject (it needs the user's JWT,
 * which only JS can read). If the task cannot start, the server's ring window
 * still ends the call.
 */
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != IncomingCallNotification.ACTION_DECLINE) return
        val data = intent.getBundleExtra(IncomingCallNotification.EXTRA_DATA) ?: return
        data.getString("callSessionId")?.let { IncomingCallNotification.cancel(context, it) }

        val delivered = IncomingCallModule.emitAction("decline", data)
        if (delivered) return
        try {
            val task = Intent(context, CallActionTaskService::class.java)
                .putExtras(Bundle(data).apply { putString("action", "decline") })
            HeadlessJsTaskService.acquireWakeLockNow(context)
            context.startService(task)
        } catch (e: Exception) {
            Log.w("CallActionReceiver", "Could not start the decline task", e)
        }
    }
}
