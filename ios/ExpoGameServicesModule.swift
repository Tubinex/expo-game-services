import ExpoModulesCore
import GameKit
import UIKit

public final class ExpoGameServicesModule: Module {
  private let presenter = GameCenterPresenter.shared
  private var authenticationHandlerInstalled = false
  private var pendingSignInPromises: [Promise] = []

  public func definition() -> ModuleDefinition {
    Name("ExpoGameServices")

    Events("onAuthenticationStateChanged")

    OnCreate { [weak self] in
      self?.installAuthenticationHandler()
    }

    AsyncFunction("getAuthenticationState") { () -> [String: Any] in
      self.authenticationState()
    }

    AsyncFunction("signIn") { (promise: Promise) in
      let player = GKLocalPlayer.local
      if player.isAuthenticated {
        promise.resolve(self.authenticationState())
        return
      }
      self.pendingSignInPromises.append(promise)
      if !self.presenter.isPresentingAuthentication {
        self.authenticationHandlerInstalled = false
        GKLocalPlayer.local.authenticateHandler = nil
        self.installAuthenticationHandler()
      }
    }

    AsyncFunction("getCapabilities") { () -> [String: Any] in
      [
        "platform": "gameCenter",
        "available": true,
        "authentication": true,
        "serverIdentityProof": true,
        "achievements": true,
        "incrementalAchievements": false,
        "leaderboards": true,
        "leaderboardScoreQueries": true,
        "nativeLeaderboardUI": true,
      ]
    }

    AsyncFunction("requestServerIdentityProof") { (_: JavaScriptValue, promise: Promise) in
      guard GKLocalPlayer.local.isAuthenticated else {
        promise.reject("NOT_AUTHENTICATED", "Game Center authentication is required.")
        return
      }

      GKLocalPlayer.local.generateIdentityVerificationSignature { publicKeyURL, signature, salt, timestamp, error in
        if let error {
          NSLog("ExpoGameServices Game Center identity proof failed: %@", error.localizedDescription)
          promise.reject("PROVIDER_ERROR", "Could not create a Game Center identity proof: \(error.localizedDescription)")
          return
        }
        guard let publicKeyURL, let signature, let salt else {
          promise.reject("PROVIDER_ERROR", "Game Center did not return an identity proof.")
          return
        }
        promise.resolve([
          "type": "gameCenterIdentitySignature",
          "playerId": GKLocalPlayer.local.gamePlayerID,
          "publicKeyUrl": publicKeyURL.absoluteString,
          "signature": signature.base64EncodedString(),
          "salt": salt.base64EncodedString(),
          "timestamp": timestamp,
        ])
      }
    }

    AsyncFunction("loadAchievements") { (promise: Promise) in
      GKAchievementDescription.loadAchievementDescriptions { descriptions, descriptionError in
        if let descriptionError {
          promise.reject("PROVIDER_ERROR", "Could not load Game Center achievement descriptions.")
          return
        }
        GKAchievement.loadAchievements { achievements, achievementError in
          if let achievementError {
            promise.reject("PROVIDER_ERROR", "Could not load Game Center achievements.")
            return
          }
          let progressByID = Dictionary(uniqueKeysWithValues: (achievements ?? []).map { ($0.identifier, $0) })
          let response = (descriptions ?? []).map { description -> [String: Any] in
            let progress = progressByID[description.identifier]
            return [
              "id": description.identifier,
              "title": description.title,
              "description": description.achievedDescription,
              "percentComplete": progress?.percentComplete ?? 0,
              "isUnlocked": (progress?.percentComplete ?? 0) >= 100,
              "lastReportedDate": Self.isoDate(progress?.lastReportedDate),
            ]
          }
          promise.resolve(response)
        }
      }
    }

    AsyncFunction("reportAchievement") { (achievementID: String, percentComplete: Double, promise: Promise) in
      guard GKLocalPlayer.local.isAuthenticated else {
        promise.reject("NOT_AUTHENTICATED", "Game Center authentication is required.")
        return
      }
      let achievement = GKAchievement(identifier: achievementID)
      achievement.percentComplete = min(max(percentComplete, 0), 100)
      achievement.showsCompletionBanner = true
      GKAchievement.report([achievement]) { error in
        if let error {
          promise.reject("PROVIDER_ERROR", "Could not report the Game Center achievement.")
        } else {
          promise.resolve()
        }
      }
    }

    AsyncFunction("incrementAchievement") { (_: String, _: Int, promise: Promise) in
      promise.reject("FEATURE_UNSUPPORTED", "Game Center does not support step-based achievement increments.")
    }

    AsyncFunction("showAchievements") { (promise: Promise) in
      self.presenter.showAchievements(promise: promise)
    }

    AsyncFunction("loadLeaderboardMetadata") { (identifiers: [String]?, promise: Promise) in
      GKLeaderboard.loadLeaderboards(IDs: identifiers) { leaderboards, error in
        if let error {
          promise.reject("PROVIDER_ERROR", "Could not load Game Center leaderboards.")
          return
        }
        promise.resolve((leaderboards ?? []).map {
          ["id": $0.baseLeaderboardID, "title": $0.title, "sortOrder": "descending"]
        })
      }
    }

    AsyncFunction("loadLeaderboardScores") { (request: [String: Any], promise: Promise) in
      self.loadLeaderboardScores(request: request, currentPlayerOnly: false, promise: promise)
    }

    AsyncFunction("loadCurrentPlayerScore") { (request: [String: Any], promise: Promise) in
      self.loadLeaderboardScores(request: request, currentPlayerOnly: true, promise: promise)
    }

    AsyncFunction("submitLeaderboardScore") { (leaderboardID: String, score: Int, context: String?, promise: Promise) in
      guard GKLocalPlayer.local.isAuthenticated else {
        promise.reject("NOT_AUTHENTICATED", "Game Center authentication is required.")
        return
      }
      let gameScore = GKScore(leaderboardIdentifier: leaderboardID)
      gameScore.value = Int64(score)
      gameScore.context = UInt64(context ?? "") ?? 0
      GKScore.report([gameScore]) { error in
        if let error {
          promise.reject("PROVIDER_ERROR", "Could not submit the Game Center score.")
        } else {
          promise.resolve()
        }
      }
    }

    AsyncFunction("showLeaderboards") { (options: [String: Any], promise: Promise) in
      self.presenter.showLeaderboards(leaderboardID: options["leaderboardId"] as? String, promise: promise)
    }
  }

  private func installAuthenticationHandler() {
    guard !authenticationHandlerInstalled else { return }
    authenticationHandlerInstalled = true
    GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
      if let viewController {
        self?.presenter.presentAuthentication(viewController)
        return
      }
      self?.presenter.finishAuthenticationPresentation()
      if GKLocalPlayer.local.isAuthenticated {
        self?.resolvePendingSignIns()
      } else if let error {
        NSLog("ExpoGameServices Game Center sign-in failed: %@", error.localizedDescription)
        self?.resolvePendingSignIns(state: Self.unavailableState(reason: error.localizedDescription))
      } else {
        self?.resolvePendingSignIns()
      }
      self?.sendEvent("onAuthenticationStateChanged", self?.authenticationState() ?? Self.unavailableState())
    }
  }

  private func resolvePendingSignIns(state: [String: Any]? = nil) {
    let state = state ?? authenticationState()
    let promises = pendingSignInPromises
    pendingSignInPromises.removeAll()
    for promise in promises {
      promise.resolve(state)
    }
  }

  private func authenticationState() -> [String: Any] {
    let player = GKLocalPlayer.local
    guard player.isAuthenticated else {
      return ["status": "unauthenticated", "platform": "gameCenter"]
    }
    return [
      "status": "authenticated",
      "platform": "gameCenter",
      "player": ["id": player.gamePlayerID, "displayName": player.displayName, "alias": player.alias],
    ]
  }

  private static func unavailableState(reason: String = "Game Center is unavailable.") -> [String: Any] {
    ["status": "unavailable", "platform": "gameCenter", "reason": reason]
  }

  private func loadLeaderboardScores(request: [String: Any], currentPlayerOnly: Bool, promise: Promise) {
    guard let leaderboardID = request["leaderboardId"] as? String else {
      promise.reject("INVALID_ARGUMENT", "leaderboardId is required.")
      return
    }
    GKLeaderboard.loadLeaderboards(IDs: [leaderboardID]) { leaderboards, loadError in
      if let loadError {
        promise.reject("PROVIDER_ERROR", "Could not load Game Center leaderboard scores.")
        return
      }
      guard let leaderboard = leaderboards?.first else {
        promise.reject("PROVIDER_ERROR", "Game Center did not return the requested leaderboard.")
        return
      }
      let position = max((request["position"] as? Int ?? 1) - 1, 0)
      let range = max(request["range"] as? Int ?? 25, 1)
      leaderboard.loadEntries(
        for: self.playerScope(request["collection"] as? String),
        timeScope: self.timeScope(request["timeScope"] as? String),
        range: NSRange(location: position, length: range)
      ) { localPlayerEntry, entries, _, error in
        if let error {
          promise.reject("PROVIDER_ERROR", "Could not load Game Center leaderboard scores.")
          return
        }
        let selectedEntries = currentPlayerOnly ? (localPlayerEntry.map { [$0] } ?? []) : (entries ?? [])
        let response = selectedEntries.map { entry -> [String: Any] in
          [
            "leaderboardId": leaderboardID,
            "rank": entry.rank,
            "score": entry.score,
            "formattedScore": entry.formattedScore,
            "player": ["id": entry.player.gamePlayerID, "displayName": entry.player.displayName, "alias": entry.player.alias],
            "timestamp": Self.isoDate(entry.date),
          ]
        }
        promise.resolve([
          "leaderboard": ["id": leaderboardID, "title": leaderboard.title ?? leaderboardID, "sortOrder": "descending"],
          "scores": response,
        ])
      }
    }
  }

  private func playerScope(_ collection: String?) -> GKLeaderboard.PlayerScope {
    collection == "friends" ? .friendsOnly : .global
  }

  private func timeScope(_ scope: String?) -> GKLeaderboard.TimeScope {
    switch scope {
    case "today": return .today
    case "week": return .week
    default: return .allTime
    }
  }

  private static func isoDate(_ date: Date?) -> String? {
    guard let date else { return nil }
    return ISO8601DateFormatter().string(from: date)
  }
}

private final class GameCenterPresenter: NSObject, GKGameCenterControllerDelegate {
  static let shared = GameCenterPresenter()
  private var dismissPromise: Promise?
  private(set) var isPresentingAuthentication = false

  func presentAuthentication(_ viewController: UIViewController) {
    DispatchQueue.main.async(execute: {
      guard let presenter = self.topViewController(), presenter.presentedViewController == nil else { return }
      self.isPresentingAuthentication = true
      presenter.present(viewController, animated: true)
    })
  }

  func finishAuthenticationPresentation() {
    DispatchQueue.main.async(execute: {
      self.isPresentingAuthentication = false
    })
  }

  func showAchievements(promise: Promise) {
    let controller = GKGameCenterViewController(state: .achievements)
    present(controller, promise: promise)
  }

  func showLeaderboards(leaderboardID: String?, promise: Promise) {
    let controller = GKGameCenterViewController(state: .leaderboards)
    controller.leaderboardIdentifier = leaderboardID
    present(controller, promise: promise)
  }

  func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
    gameCenterViewController.dismiss(animated: true) {
      self.dismissPromise?.resolve()
      self.dismissPromise = nil
    }
  }

  private func present(_ controller: GKGameCenterViewController, promise: Promise) {
    DispatchQueue.main.async(execute: {
      guard self.dismissPromise == nil, let presenter = self.topViewController(), presenter.presentedViewController == nil else {
        promise.reject("PRESENTATION_BUSY", "Another native view controller is already presented.")
        return
      }
      self.dismissPromise = promise
      controller.gameCenterDelegate = self
      presenter.present(controller, animated: true)
    })
  }

  private func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    guard let root = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return nil }
    var current = root
    while let presented = current.presentedViewController { current = presented }
    return current
  }
}
