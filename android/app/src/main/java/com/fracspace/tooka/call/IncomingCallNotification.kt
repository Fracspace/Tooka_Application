package com.fracspace.tooka.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import com.fracspace.tooka.MainActivity
import com.fracspace.tooka.R

/**
 * The ringing notification for a call pushed while Tooka is in the background or killed.
 * Full-screen on a locked phone, a heads-up call notification otherwise. Answer and a tap
 * open MainActivity (which hands the action to JS); Decline goes to CallActionReceiver.
 */
object IncomingCallNotification {
    const val ACTION_OPEN = "com.fracspace.tooka.CALL_OPEN"
    const val ACTION_ANSWER = "com.fracspace.tooka.CALL_ANSWER"
    const val ACTION_DECLINE = "com.fracspace.tooka.CALL_DECLINE"
    const val EXTRA_DATA = "tooka_call_data"

    private const val CHANNEL_ID = "tooka_incoming_calls"
    private const val TAG = "incoming-call"

    // Calls already stopped here (declined, cancelled, ended). The same push reaches both
    // CallPushReceiver and the JS background handler; a late show() must not ring them again.
    private val stopped = java.util.Collections.synchronizedSet(LinkedHashSet<String>())
    private val ringing = java.util.Collections.synchronizedSet(LinkedHashSet<String>())

    fun isRinging(callSessionId: String) = ringing.contains(callSessionId)

    /** Set by MainActivity: while Tooka is on screen the in-app call screen rings, not this. */
    @Volatile
    var appVisible = false

    fun callerName(data: Bundle): String =
        data.getString("spaName")?.takeIf { it.isNotBlank() }
            ?: data.getString("callerName")?.takeIf { it.isNotBlank() }
            ?: "Spa"

    fun show(context: Context, data: Bundle) {
        val callSessionId = data.getString("callSessionId") ?: return
        if (stopped.contains(callSessionId)) return
        if (remainingMs(data) == null) return
        ensureChannel(context)

        val name = callerName(data)
        val code = callSessionId.hashCode()

        // Tapping the notification, or a locked phone, opens the native ringing screen at once.
        val openIntent = PendingIntent.getActivity(
            context,
            code,
            Intent(context, IncomingCallActivity::class.java)
                .putExtra(EXTRA_DATA, data)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val answerIntent = activityIntent(context, ACTION_ANSWER, data, code + 1)
        val declineIntent = PendingIntent.getBroadcast(
            context,
            code + 2,
            Intent(context, CallActionReceiver::class.java)
                .setAction(ACTION_DECLINE)
                .putExtra(EXTRA_DATA, data),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val caller = Person.Builder().setName(name).setImportant(true).build()
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(name)
            .setContentText("Incoming Tooka call")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setContentIntent(openIntent)
            .setFullScreenIntent(openIntent, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent))

        remainingMs(data)?.let { builder.setTimeoutAfter(it) }

        val notification = builder.build().apply { flags = flags or Notification.FLAG_INSISTENT }
        try {
            ringing.add(callSessionId)
            NotificationManagerCompat.from(context).notify(TAG, code, notification)
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS not granted: nothing we can show.
        }
    }

    fun cancel(context: Context, callSessionId: String) {
        stopped.add(callSessionId)
        while (stopped.size > 50) stopped.remove(stopped.first())
        ringing.remove(callSessionId)
        NotificationManagerCompat.from(context).cancel(TAG, callSessionId.hashCode())
        IncomingCallActivity.close(callSessionId)
    }

    /** Android 14+ lets the user turn off full-screen call screens per app. */
    fun canUseFullScreen(context: Context): Boolean =
        Build.VERSION.SDK_INT < 34 ||
            context.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() != false

    private fun activityIntent(context: Context, action: String, data: Bundle, code: Int): PendingIntent =
        PendingIntent.getActivity(
            context,
            code,
            Intent(context, MainActivity::class.java)
                .setAction(action)
                .putExtra(EXTRA_DATA, data)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    /** Ring until the server's ring window closes (expiresAt), never past 60s; null once it has closed. */
    private fun remainingMs(data: Bundle): Long? {
        val expiresAt = data.getString("expiresAt") ?: return 60_000L
        val at = parseIso(expiresAt) ?: return 60_000L
        val left = at - System.currentTimeMillis()
        if (left <= 0) return null
        return left.coerceAtMost(60_000L)
    }

    // java.time needs API 26; minSdk is 24.
    private fun parseIso(value: String): Long? {
        for (pattern in arrayOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")) {
            try {
                val format = java.text.SimpleDateFormat(pattern, java.util.Locale.US)
                format.timeZone = java.util.TimeZone.getTimeZone("UTC")
                return format.parse(value)?.time
            } catch (e: Exception) {
                // try the next pattern
            }
        }
        return null
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val sound = Uri.parse("android.resource://${context.packageName}/${R.raw.incoming_ring}")
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Rings when a spa calls you"
                setSound(
                    sound,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 1000)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
    }
}
