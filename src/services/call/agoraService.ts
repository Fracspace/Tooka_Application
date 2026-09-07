import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngineEventHandler,
  AudioProfileType,
  AudioScenarioType,
} from 'react-native-agora';
import { Platform } from 'react-native';

const getLogContext = (): any => {
  try {
    const { callService } = require('./callService');
    const { callLogger } = require('./callLogger');
    const pending = callService.getPendingSession();
    const connecting = callService.getConnectingSession();
    const active = callService.getActiveSession();
    const session = active || connecting || pending;
    
    return {
      sessionId: session?.sessionId || 'NO_SESSION',
      callState: callLogger.getCallState(),
      channelName: session?.channelName || 'N/A',
      uid: session?.uid || 0
    };
  } catch (e) {
    return { sessionId: 'NO_SESSION', callState: 'UNKNOWN' };
  }
};

class AgoraService {
  private engine?: IRtcEngine;
  private isInitialized = false;
  
  // Idempotency state guards
  private isJoining = false;
  private isJoined = false;
  private currentChannel: string | null = null;
  private currentUid: number | null = null;

  private eventHandlers: Set<Partial<IRtcEngineEventHandler>> = new Set();

  getIsJoining(): boolean {
    return this.isJoining;
  }

  getIsJoined(): boolean {
    return this.isJoined;
  }

  getCurrentChannel(): string | null {
    return this.currentChannel;
  }

  async initialize(appId: string): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AGORA', 'ENTER: initialize', ctx, { appId });

    if (this.isInitialized && this.engine) {
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `initialize ignored. Engine already initialized. Duration: ${duration}ms`, ctx);
      return;
    }

    console.log(`[AgoraService] Initializing engine with appId: ${appId}`);
    try {
      const createStart = Date.now();
      callLogger.info('AGORA', 'Calling createAgoraRtcEngine()', ctx);
      this.engine = createAgoraRtcEngine();
      callLogger.info('AGORA', `createAgoraRtcEngine() succeeded. Duration: ${Date.now() - createStart}ms`, ctx);

      const initStart = Date.now();
      callLogger.info('AGORA', 'Calling engine.initialize()', ctx, { appId });
      const initResult = this.engine.initialize({ appId });
      callLogger.info('AGORA', `engine.initialize() returned. Result: ${initResult}, Duration: ${Date.now() - initStart}ms`, ctx);
      
      this.engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      this.engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      this.engine.enableAudio();

//       this.engine.enableLocalAudio(true);
//       this.engine.muteLocalAudioStream(false);

// console.log('[Agora] Forced local audio enabled after join');
      this.engine.enableAudioVolumeIndication(
        300,   // interval in ms
        3,     // smooth
        true,  // report local user
      );
      console.log("[Agora] Audio module enabled");

      // Configure Audio Session for background, bluetooth, speaker
      if (Platform.OS === 'ios') {
        this.engine.setAudioProfile(AudioProfileType.AudioProfileDefault, AudioScenarioType.AudioScenarioDefault);
      } else {
        this.engine.setAudioProfile(AudioProfileType.AudioProfileDefault, AudioScenarioType.AudioScenarioChatroom);
      }

      this.engine.setDefaultAudioRouteToSpeakerphone(false); // Default to earpiece for calls

      this.registerInternalCallbacks();
      this.isInitialized = true;
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `EXIT: initialize - SUCCESS. Duration: ${duration}ms`, ctx);
    } catch (error) {
      const duration = Date.now() - startTime;
      callLogger.error('AGORA', `EXIT: initialize - FAILURE. Duration: ${duration}ms`, ctx, error);
      throw error;
    }
  }

  private registerInternalCallbacks() {
    if (!this.engine) return;

    this.engine.registerEventHandler({
      onJoinChannelSuccess: (connection, elapsed) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onJoinChannelSuccess - channel=${connection.channelId}, uid=${connection.localUid}, elapsed=${elapsed}ms`, ctx, { connection, elapsed });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, { localAudioState: 'joined' });
        
        this.isJoining = false;
        this.isJoined = true;
        this.emit('onJoinChannelSuccess', connection, elapsed);
      },
      onLeaveChannel: (connection, stats) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onLeaveChannel - duration=${stats.duration}s`, ctx, { connection, stats });
        
        callLogger.resetAudioSnapshot(ctx?.sessionId || 'global');
        
        this.resetInternalState();
        this.emit('onLeaveChannel', connection, stats);
      },
      onUserJoined: (connection, remoteUid, elapsed) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onUserJoined - remoteUid=${remoteUid}, elapsed=${elapsed}ms`, ctx, { connection, remoteUid, elapsed });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, { remoteJoined: true });
        
        this.emit('onUserJoined', connection, remoteUid, elapsed);
      },
      onUserOffline: (connection, remoteUid, reason) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onUserOffline - remoteUid=${remoteUid}, reason=${reason}`, ctx, { connection, remoteUid, reason });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, { remoteJoined: false });
        
        this.emit('onUserOffline', connection, remoteUid, reason);
      },
      onConnectionStateChanged: (connection, state, reason) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onConnectionStateChanged - state=${state}, reason=${reason}`, ctx, { connection, state, reason });
        this.emit('onConnectionStateChanged', connection, state, reason);
      },
      onConnectionLost: (connection) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.warn('AGORA', 'Callback: onConnectionLost', ctx, { connection });
        this.emit('onConnectionLost', connection);
      },
      onRejoinChannelSuccess: (connection, elapsed) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onRejoinChannelSuccess - elapsed=${elapsed}ms`, ctx, { connection, elapsed });
        this.emit('onRejoinChannelSuccess', connection, elapsed);
      },
      onTokenPrivilegeWillExpire: (connection, token) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.warn('AGORA', 'Callback: onTokenPrivilegeWillExpire', ctx, { connection, token: token ? token.substring(0, 10) + '...' : '' });
        this.emit('onTokenPrivilegeWillExpire', connection, token);
      },
      onRequestToken: (connection) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', 'Callback: onRequestToken', ctx, { connection });
        this.emit('onRequestToken', connection);
      },
      onAudioRoutingChanged: (routing) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        // Routing values: 3 = speaker, 1 = earpiece, 0 = headset, 2 = headphones, 5 = bluetooth
        let routeStr = 'earpiece';
        if (routing === 3) routeStr = 'speaker';
        else if (routing === 0) routeStr = 'headset';
        else if (routing === 2) routeStr = 'headphones';
        else if (routing === 5) routeStr = 'bluetooth';
        
        callLogger.info('AGORA', `Callback: onAudioRoutingChanged - route=${routing} (${routeStr})`, ctx, { routing });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, {
          audioRoute: routeStr,
          speakerEnabled: routing === 3,
          bluetoothConnected: routing === 5,
          headphonesConnected: routing === 2,
        });

        this.emit('onAudioRoutingChanged', routing);
      },
      onNetworkQuality: (connection, remoteUid, txQuality, rxQuality) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.debug('AGORA', `Callback: onNetworkQuality - remoteUid=${remoteUid}, tx=${txQuality}, rx=${rxQuality}`, ctx);
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, {
          networkQualityTx: txQuality,
          networkQualityRx: rxQuality,
        });

        this.emit('onNetworkQuality', connection, remoteUid, txQuality, rxQuality);
      },
      onError: (err, msg) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.error('AGORA', `Callback: onError - code=${err}, msg=${msg}`, ctx, { err, msg });
        if (this.isJoining) {
          this.isJoining = false;
        }
        this.emit('onError', err, msg);
      },
      onAudioVolumeIndication: (connection, speakers, speakerNumber, totalVolume) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.debug('AGORA', `Callback: onAudioVolumeIndication - count=${speakerNumber}, totalVolume=${totalVolume}`, ctx, { speakers, speakerNumber, totalVolume });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, {
          volume: totalVolume,
        });

        this.emit('onAudioVolumeIndication', connection, speakers, speakerNumber, totalVolume);
      },
      onActiveSpeaker: (connection, uid) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onActiveSpeaker - uid=${uid}`, ctx, { connection, uid });
        this.emit('onActiveSpeaker', connection, uid);
      },
      onRemoteAudioStateChanged: (connection, remoteUid, state, reason, elapsed) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onRemoteAudioStateChanged - remoteUid=${remoteUid}, state=${state}, reason=${reason}, elapsed=${elapsed}ms`, ctx, { connection, remoteUid, state, reason, elapsed });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, {
          remoteAudioState: `state:${state}_reason:${reason}`,
        });

        console.log(
            "[AUDIO] RemoteAudio",
            remoteUid,
            state,
            reason
        );

        this.emit('onRemoteAudioStateChanged', connection, remoteUid, state, reason, elapsed);
      },
      onLocalAudioStateChanged: (connection, state, error) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onLocalAudioStateChanged - state=${state}, error=${error}`, ctx, { connection, state, error });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, {
          localAudioState: `state:${state}_error:${error}`,
          micMuted: state === 0,
        });
        console.log(
          "[AUDIO] LocalAudioState",
          state,
          error
        );

        this.emit('onLocalAudioStateChanged', connection, state, error);
      },
      onAudioPublishStateChanged: (channel, oldState, newState, elapseSinceLastState) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onAudioPublishStateChanged - channel=${channel}, oldState=${oldState}, newState=${newState}, elapsed=${elapseSinceLastState}ms`, ctx, { channel, oldState, newState, elapseSinceLastState });

        console.log(
          "[AUDIO] onAudioPublishStateChanged",
          channel,
          oldState,
          newState,
          elapseSinceLastState
        );
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, {
          publishState: `old:${oldState}_new:${newState}`,
        });

        this.emit('onAudioPublishStateChanged', channel, oldState, newState, elapseSinceLastState);
      },
      onAudioSubscribeStateChanged: (channel, uid, oldState, newState, elapseSinceLastState) => {
        const ctx = getLogContext();
        const { callLogger } = require('./callLogger');
        callLogger.info('AGORA', `Callback: onAudioSubscribeStateChanged - channel=${channel}, uid=${uid}, oldState=${oldState}, newState=${newState}, elapsed=${elapseSinceLastState}ms`, ctx, { channel, uid, oldState, newState, elapseSinceLastState });
        
        callLogger.updateAudioSnapshot(ctx?.sessionId, {
          subscribeState: `old:${oldState}_new:${newState}`,
        });

        this.emit('onAudioSubscribeStateChanged', channel, uid, oldState, newState, elapseSinceLastState);
      },
    });
  }

  addListener(handler: Partial<IRtcEngineEventHandler>) {
    this.eventHandlers.add(handler);
  }

  removeListener(handler: Partial<IRtcEngineEventHandler>) {
    this.eventHandlers.delete(handler);
  }

  private emit<K extends keyof IRtcEngineEventHandler>(event: K, ...args: Parameters<NonNullable<IRtcEngineEventHandler[K]>>) {
    this.eventHandlers.forEach((handler) => {
      const cb = handler[event];
      if (typeof cb === 'function') {
        // @ts-ignore
        cb(...args);
      }
    });
  }

  private resetInternalState() {
    this.isJoining = false;
    this.isJoined = false;
    this.currentChannel = null;
    this.currentUid = null;
  }

  async joinChannel(token: string, channelName: string, uid: number): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AGORA', 'ENTER: joinChannel', ctx, { token, channelName, uid });

    if (!this.isInitialized || !this.engine) {
      const duration = Date.now() - startTime;
      const err = new Error('Agora Engine not initialized');
      callLogger.error('AGORA', `EXIT: joinChannel - FAILURE. Duration: ${duration}ms`, ctx, err);
      throw err;
    }

    if (this.isJoining) {
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `joinChannel ignored. Already currently joining a channel. Duration: ${duration}ms`, ctx);
      return;
    }

    if (this.isJoined) {
      if (this.currentChannel === channelName) {
        const duration = Date.now() - startTime;
        callLogger.info('AGORA', `joinChannel ignored. Already joined channel: ${channelName}. Duration: ${duration}ms`, ctx);
        return;
      }
      console.log(`[AgoraService] Leaving previous channel ${this.currentChannel} before joining new channel.`);
      await this.leaveChannel();
    }

    console.log(`[AgoraService] Joining channel: ${channelName} with uid: ${uid}`);
    
    this.isJoining = true;
    this.currentChannel = channelName;
    this.currentUid = uid;

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout>;

      // PR-1: `settled` makes this attempt's handlers inert once the promise has
      // been resolved or rejected. Without it, any later Agora callback re-entered
      // them - and the onError branch calls resetInternalState(), which would flip
      // isJoined to false during a LIVE call and turn the later leaveChannel() into
      // a no-op, leaving the channel joined and the mic publishing after hangup.
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeoutId);
        // PR-1: eventHandlers is a Set keyed by object IDENTITY. The old code added
        // one object literal and removed a different, freshly-built one, so
        // Set.delete() never matched and NO join listener was ever removed: one
        // orphaned handler pair leaked per join attempt for the life of the process.
        // Remove the exact reference we added.
        this.removeListener(joinHandler);
      };

      const joinHandler: Partial<IRtcEngineEventHandler> = {
        onJoinChannelSuccess: (connection: any, elapsed: number) => {
          if (settled) return;
          if (connection.channelId !== channelName) return;
          settled = true;

          console.log("[Agora] Join success - enabling local audio");

          console.log("[AUDIO] enableAudio()");
          this.engine?.enableAudio();

          console.log("[AUDIO] enableLocalAudio(true)");
          this.engine?.enableLocalAudio(true);

          console.log("[AUDIO] muteLocalAudioStream(false)");
          this.engine?.muteLocalAudioStream(false);

          console.log("[Agora] Forced microphone ON after join");

          // PR-7: pin the route on every join. The engine keeps the last
          // setEnableSpeakerphone() value for the life of the process, while the UI
          // resets isSpeaker to false after each call - so call #2 started on
          // speakerphone while the button showed earpiece.
          this.engine?.setEnableSpeakerphone(false);

          const duration = Date.now() - startTime;
          callLogger.info(
            'AGORA',
            `joinChannel promise resolved: Successfully joined channel: ${channelName}. Duration: ${duration}ms`,
            ctx
          );

          cleanup();
          resolve();
        },

        onError: (err: number, msg: string) => {
          if (settled) return;
          const duration = Date.now() - startTime;
          callLogger.error('AGORA', `joinChannel promise rejected: error: ${msg} (${err}). Duration: ${duration}ms`, ctx);
          settled = true;
          // If err === 17, it means already joined. We can resolve.
          if (err === 17) {
            cleanup();
            resolve();
          } else {
            cleanup();
            this.resetInternalState();
            reject(new Error(`Agora join error: ${err} - ${msg}`));
          }
        },
      };

      this.addListener(joinHandler);

      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        const duration = Date.now() - startTime;
        callLogger.error('AGORA', `joinChannel promise timed out after 15s. Duration: ${duration}ms`, ctx);
        cleanup();
        this.leaveChannel();
        reject(new Error('Agora join channel timeout'));
      }, 15000);

      try {
        const callStart = Date.now();
        const result = this.engine!.joinChannel(token, channelName, uid, {
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          autoSubscribeAudio: true,
        });
        callLogger.info('AGORA', `engine.joinChannel() API returned. Result: ${result}, Duration: ${Date.now() - callStart}ms`, ctx);
      } catch (err) {
        const duration = Date.now() - startTime;
        callLogger.error('AGORA', `engine.joinChannel() API threw exception. Duration: ${duration}ms`, ctx, err);
        cleanup();
        this.resetInternalState();
        reject(err);
      }
    });
  }

  async leaveChannel(): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AGORA', 'ENTER: leaveChannel', ctx);

    if (!this.isInitialized || !this.engine) {
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `leaveChannel ignored. Engine not initialized. Duration: ${duration}ms`, ctx);
      return;
    }
    
    if (!this.isJoined && !this.isJoining) {
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `leaveChannel ignored. Not currently joined or joining. Duration: ${duration}ms`, ctx);
      return;
    }

    console.log(`[AgoraService] Leaving channel: ${this.currentChannel || 'unknown'}`);
    try {
      const callStart = Date.now();
      const result = this.engine.leaveChannel();
      this.resetInternalState();
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `EXIT: leaveChannel - SUCCESS. Result: ${result}, API Duration: ${Date.now() - callStart}ms, Total Duration: ${duration}ms`, ctx);
    } catch (e) {
      const duration = Date.now() - startTime;
      callLogger.error('AGORA', `EXIT: leaveChannel - FAILURE. Duration: ${duration}ms`, ctx, e);
      throw e;
    }
  }

  async muteLocalAudioStream(muted: boolean): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AGORA', `ENTER: muteLocalAudioStream - muted=${muted}`, ctx);

    if (!this.isInitialized || !this.engine) {
      const duration = Date.now() - startTime;
      callLogger.warn('AGORA', `muteLocalAudioStream ignored. Engine not initialized. Duration: ${duration}ms`, ctx);
      return;
    }
    
    try {
      const callStart = Date.now();
      const result = this.engine.muteLocalAudioStream(muted);
      
      callLogger.updateAudioSnapshot(ctx?.sessionId, { micMuted: muted });

      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `EXIT: muteLocalAudioStream - SUCCESS. Result: ${result}, API Duration: ${Date.now() - callStart}ms, Total Duration: ${duration}ms`, ctx);
    } catch (e) {
      const duration = Date.now() - startTime;
      callLogger.error('AGORA', `EXIT: muteLocalAudioStream - FAILURE. Duration: ${duration}ms`, ctx, e);
      throw e;
    }
  }

  async setEnableSpeakerphone(enabled: boolean): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AGORA', `ENTER: setEnableSpeakerphone - enabled=${enabled}`, ctx);

    if (!this.isInitialized || !this.engine) {
      const duration = Date.now() - startTime;
      callLogger.warn('AGORA', `setEnableSpeakerphone ignored. Engine not initialized. Duration: ${duration}ms`, ctx);
      return;
    }

    try {
      const callStart = Date.now();
      const result = this.engine.setEnableSpeakerphone(enabled);
      
      callLogger.updateAudioSnapshot(ctx?.sessionId, { speakerEnabled: enabled });

      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `EXIT: setEnableSpeakerphone - SUCCESS. Result: ${result}, API Duration: ${Date.now() - callStart}ms, Total Duration: ${duration}ms`, ctx);
    } catch (e) {
      const duration = Date.now() - startTime;
      callLogger.error('AGORA', `EXIT: setEnableSpeakerphone - FAILURE. Duration: ${duration}ms`, ctx, e);
      throw e;
    }
  }

  /**
   * PR-7: hand the engine a fresh token. Agora tokens are minted with
   * expires_in: 3600, and nothing renewed them - a call crossing the hour mark simply
   * dropped with error 109 ("Token expired. Please rejoin.") and no recovery.
   */
  async renewToken(token: string): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();

    if (!this.isInitialized || !this.engine) {
      callLogger.warn('AGORA', 'renewToken ignored. Engine not initialized.', ctx);
      return;
    }

    try {
      const result = this.engine.renewToken(token);
      callLogger.info('AGORA', `EXIT: renewToken - SUCCESS. Result: ${result}, Duration: ${Date.now() - startTime}ms`, ctx);
    } catch (e) {
      callLogger.error('AGORA', `EXIT: renewToken - FAILURE. Duration: ${Date.now() - startTime}ms`, ctx, e);
      throw e;
    }
  }

  async release(): Promise<void> {
    const startTime = Date.now();
    const { callLogger } = require('./callLogger');
    const ctx = getLogContext();
    callLogger.info('AGORA', 'ENTER: release', ctx);

    if (this.engine) {
      console.log('[AgoraService] Releasing engine resources');
      await this.leaveChannel();
      const callStart = Date.now();
      this.engine.release();
      this.engine = undefined;
      this.isInitialized = false;
      this.eventHandlers.clear();
      this.resetInternalState();
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `EXIT: release - SUCCESS. API Duration: ${Date.now() - callStart}ms, Total Duration: ${duration}ms`, ctx);
    } else {
      const duration = Date.now() - startTime;
      callLogger.info('AGORA', `release ignored. No engine instance exists. Duration: ${duration}ms`, ctx);
    }
  }
}

export const agoraService = new AgoraService();
