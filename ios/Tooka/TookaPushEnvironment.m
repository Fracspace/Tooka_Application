#import <React/RCTBridgeModule.h>

/**
 * Which APNs server this build's pushes come from, read from how the app is signed,
 * not from Debug/Release: a Release build signed with a development profile still gets
 * sandbox pushes, and the backend must send them to the sandbox server.
 *   - No embedded profile (App Store, TestFlight): production.
 *   - Profile with aps-environment "development": sandbox; otherwise production.
 */
@interface TookaPushEnvironment : NSObject <RCTBridgeModule>
@end

@implementation TookaPushEnvironment

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(apnsEnvironment)
{
  NSString *path = [[NSBundle mainBundle] pathForResource:@"embedded" ofType:@"mobileprovision"];
  if (!path) {
    return @"production";
  }
  NSData *data = [NSData dataWithContentsOfFile:path];
  // The profile is a signed plist; its XML is readable as plain text.
  NSString *profile = data ? [[NSString alloc] initWithData:data encoding:NSISOLatin1StringEncoding] : nil;
  NSRange key = profile ? [profile rangeOfString:@"<key>aps-environment</key>"] : NSMakeRange(NSNotFound, 0);
  if (key.location == NSNotFound) {
    return @"production";
  }
  NSUInteger start = NSMaxRange(key);
  NSString *value = [profile substringWithRange:NSMakeRange(start, MIN((NSUInteger)80, profile.length - start))];
  return [value containsString:@"development"] ? @"sandbox" : @"production";
}

@end
