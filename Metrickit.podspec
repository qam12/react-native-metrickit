require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Metrickit"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  # MetricKit crash/hang diagnostics require iOS 14+. React Native's supported
  # floor (>= iOS 15 for RN 0.85) already satisfies that; `@available` guards +
  # weak-linking keep the module a clean no-op if it is ever run lower.
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/qam12/react-native-metrickit.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"

  s.swift_version = "5.0"
  s.weak_frameworks = "MetricKit"
  s.frameworks = "UserNotifications"

  # DEFINES_MODULE lets the Objective-C++ TurboModule import the generated
  # `Metrickit-Swift.h` interop header for the Swift MetricKit implementation.
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES"
  }

  install_modules_dependencies(s)
end
