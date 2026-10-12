import Foundation

/// How the screenshots are made: the app is started with `-shot 1`, `-shot 2`, … and shows that
/// screen filled with sample data. Without the argument this does nothing, and it is compiled into
/// debug builds only. Every app keeps this file as it is.
enum DebugLaunch {
    static var shot: Int? {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-shot"), i + 1 < args.count else { return nil }
        return Int(args[i + 1])
        #else
        return nil
        #endif
    }
}
