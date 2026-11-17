import UIKit
import PushKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import react_native_stallion

@main
class AppDelegate: UIResponder, UIApplicationDelegate, PKPushRegistryDelegate {
  // Set by SceneDelegate. Libraries still read the app delegate's window
  // (Firebase Messaging crashes at launch without this property).
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

    // The window and React Native start in SceneDelegate: apps built with the
    // iOS 27 SDK must use the scene lifecycle or UIKit stops them at launch.
    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
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
    // delivering them. Whether the call is still ringing is checked against the server in
    // JS (not this phone's clock, which can be off), and a dead call is ended there.
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
    completion()
  }
}

/// Creates Tooka's one window and starts React Native in it.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "Tooka", in: window, launchOptions: nil)
  }
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
