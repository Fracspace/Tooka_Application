import UIKit
import PushKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import react_native_stallion

@main
class AppDelegate: UIResponder, UIApplicationDelegate, PKPushRegistryDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()

    // Incoming calls while Tooka is closed: CallKit must be ready before any VoIP push
    // arrives, because iOS requires each one to be reported as a call right away.
    RNCallKeep.setup([
      "appName": "Tooka",
      "supportsVideo": false,
      "maximumCallGroups": "1",
      "maximumCallsPerCallGroup": "1",
      "includesCallsInRecents": false,
    ])
    RNVoipPushNotificationManager.voipRegistration()
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Tooka",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // MARK: - PushKit (VoIP pushes for incoming calls)

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {}

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let data = payload.dictionaryPayload
    let sessionId = data["callSessionId"] as? String ?? ""
    // CallKit needs a UUID; callSessionId is one, so duplicates map to the same call.
    let uuid = (UUID(uuidString: sessionId) ?? UUID()).uuidString.lowercased()
    let name = (data["spaName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
      ?? (data["callerName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
      ?? "Spa"

    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)

    // Report EVERY VoIP push to CallKit (duplicates and stale calls too), or iOS stops
    // delivering them. A call whose ring window already closed is ended straight away.
    RNCallKeep.reportNewIncomingCall(
      uuid,
      handle: name,
      handleType: "generic",
      hasVideo: false,
      localizedCallerName: name,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: data,
      withCompletionHandler: nil
    )
    if let expiresAt = data["expiresAt"] as? String,
       let expiry = ISO8601DateFormatter.withFractionalSeconds.date(from: expiresAt)
         ?? ISO8601DateFormatter().date(from: expiresAt),
       expiry < Date() {
      RNCallKeep.endCall(withUUID: uuid, reason: 3) // CXCallEndedReason.unanswered
    }
    completion()
  }
}

private extension ISO8601DateFormatter {
  static let withFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

//   override func bundleURL() -> URL? {
// #if DEBUG
//     RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
// #else
//     Bundle.main.url(forResource: "main", withExtension: "jsbundle")
// #endif
//   }
  override func bundleURL() -> URL? {
  #if DEBUG
      return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
  #else
      return StallionModule.getBundleURL()
  #endif
  }
}
