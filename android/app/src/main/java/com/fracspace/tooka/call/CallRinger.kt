package com.fracspace.tooka.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.VolumeProvider
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import com.fracspace.tooka.R

/**
 * Rings for an incoming call the way the phone's own dialer does:
 *  - follows the ringer mode: Ring plays the ringtone at the ringtone volume (and
 *    vibrates if the phone vibrates for calls), Vibrate only vibrates, Silent does nothing;
 *  - the volume buttons or the lock button silence it (the call keeps showing).
 * Used for every incoming ring on Android: the call notification (via CallRingService,
 * which keeps it alive while the app is closed) and the in-app ringing screen.
 */
object CallRinger {
    private val pattern = longArrayOf(0, 1000, 1000)

    private var ringingKey: String? = null
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var session: MediaSession? = null
    private var screenOffReceiver: BroadcastReceiver? = null
    private var appContext: Context? = null

    /** True while sound or vibration is going (not after the user silenced it). */
    @Volatile
    var isSounding = false
        private set

    @Synchronized
    fun start(context: Context, key: String) {
        if (ringingKey == key) return
        stop()
        ringingKey = key
        val app = context.applicationContext
        appContext = app
        val audio = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        when (audio.ringerMode) {
            AudioManager.RINGER_MODE_NORMAL -> {
                playSound(app)
                if (vibratesWhenRinging(app)) vibrate(app)
            }
            AudioManager.RINGER_MODE_VIBRATE -> vibrate(app)
            else -> Unit // Silent: the call shows, nothing rings.
        }
        if (isSounding) listenForSilenceKeys(app)
    }

    /** Volume / lock button: quiet now, the call itself keeps ringing on screen. */
    @Synchronized
    fun silence() {
        isSounding = false
        player?.let {
            try {
                it.stop()
            } catch (e: Exception) {
                // already stopped
            }
            it.release()
        }
        player = null
        vibrator?.cancel()
        vibrator = null
        session?.let {
            it.isActive = false
            it.release()
        }
        session = null
        screenOffReceiver?.let {
            try {
                appContext?.unregisterReceiver(it)
            } catch (e: Exception) {
                // not registered
            }
        }
        screenOffReceiver = null
    }

    /** The call stopped ringing (answered, declined, cancelled, timed out). */
    @Synchronized
    fun stop() {
        silence()
        ringingKey = null
    }

    @Synchronized
    fun stop(key: String) {
        if (ringingKey == key) stop()
    }

    private fun playSound(context: Context) {
        try {
            val uri = Uri.parse("android.resource://${context.packageName}/${R.raw.incoming_ring}")
            player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(context, uri)
                isLooping = true
                prepare()
                start()
            }
            isSounding = true
        } catch (e: Exception) {
            player?.release()
            player = null
        }
    }

    private fun vibrate(context: Context) {
        val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        } ?: return
        if (!v.hasVibrator()) return
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createWaveform(pattern, 0), attributes)
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(pattern, 0, attributes)
        }
        vibrator = v
        isSounding = true
    }

    /** "Vibrate for calls" in the phone's sound settings (names differ by maker; default on). */
    private fun vibratesWhenRinging(context: Context): Boolean =
        try {
            Settings.System.getInt(context.contentResolver, "vibrate_when_ringing", 1) == 1
        } catch (e: Exception) {
            true
        }

    /**
     * Volume keys reach an active media session even on the lock screen; the lock button
     * turns the screen off. Either one silences the ring.
     */
    private fun listenForSilenceKeys(context: Context) {
        try {
            session = MediaSession(context, "TookaIncomingCall").apply {
                setPlaybackToRemote(object : VolumeProvider(VOLUME_CONTROL_RELATIVE, 100, 50) {
                    override fun onAdjustVolume(direction: Int) {
                        silence()
                    }
                })
                setPlaybackState(
                    PlaybackState.Builder()
                        .setState(PlaybackState.STATE_PLAYING, 0, 1f)
                        .build(),
                )
                isActive = true
            }
        } catch (e: Exception) {
            session = null
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, intent: Intent) {
                if (intent.action == Intent.ACTION_SCREEN_OFF) silence()
            }
        }
        try {
            context.registerReceiver(receiver, IntentFilter(Intent.ACTION_SCREEN_OFF))
            screenOffReceiver = receiver
        } catch (e: Exception) {
            // cannot listen; the volume keys still work
        }
    }
}
