require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'ExpoGameServices'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.authors = { 'Tubinex' => 'hello@tubinex.com' }
  s.homepage = 'https://github.com/tubinex/expo-game-services'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/tubinex/expo-game-services.git', :tag => s.version.to_s }
  s.static_framework = true
  s.source_files = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameKit'
  s.swift_version = '5.9'
end
