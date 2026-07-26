package expo.modules.gameservices

import android.content.Intent
import com.google.android.gms.games.AchievementsClient
import com.google.android.gms.games.GamesSignInClient
import com.google.android.gms.games.LeaderboardsClient
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.Player
import com.google.android.gms.games.achievement.Achievement
import com.google.android.gms.games.leaderboard.Leaderboard
import com.google.android.gms.games.leaderboard.LeaderboardScore
import com.google.android.gms.games.leaderboard.LeaderboardVariant
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class ExpoGameServicesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoGameServices")

    Events("onAuthenticationStateChanged")

    AsyncFunction("getAuthenticationState") { promise: Promise ->
      withAuthenticationState(promise)
    }

    AsyncFunction("signIn") { promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      PlayGames.getGamesSignInClient(activity).signIn().addOnCompleteListener { task ->
        if (!task.isSuccessful) {
          rejectProviderError(promise, "Could not sign in to Google Play Games.", task.exception)
          return@addOnCompleteListener
        }
        withAuthenticationState(promise)
      }
    }

    AsyncFunction("getCapabilities") { promise: Promise ->
      promise.resolve(
        mapOf(
          "platform" to "playGames",
          "available" to true,
          "authentication" to true,
          "serverIdentityProof" to true,
          "achievements" to true,
          "incrementalAchievements" to true,
          "leaderboards" to true,
          "leaderboardScoreQueries" to true,
          "nativeLeaderboardUI" to true,
        ),
      )
    }

    AsyncFunction("requestServerIdentityProof") { options: Map<String, Any?>, promise: Promise ->
      val serverClientId = options["serverClientId"] as? String
      if (serverClientId.isNullOrBlank()) {
        promise.reject("INVALID_ARGUMENT", "serverClientId is required for Play Games server authentication.", null)
        return@AsyncFunction
      }
      val activity = requireActivity(promise) ?: return@AsyncFunction
      val forceRefreshToken = options["forceRefreshToken"] as? Boolean ?: false
      PlayGames.getGamesSignInClient(activity)
        .requestServerSideAccess(serverClientId, forceRefreshToken)
        .addOnCompleteListener { task ->
          if (!task.isSuccessful) {
            rejectProviderError(promise, "Could not request a Play Games server auth code.", task.exception)
            return@addOnCompleteListener
          }
          promise.resolve(mapOf("type" to "playGamesServerAuthCode", "serverAuthCode" to task.result))
        }
    }

    AsyncFunction("loadAchievements") { promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      PlayGames.getAchievementsClient(activity).load(true).addOnCompleteListener { task ->
        if (!task.isSuccessful) {
          rejectProviderError(promise, "Could not load Play Games achievements.", task.exception)
          return@addOnCompleteListener
        }
        val buffer = task.result.get()
        if (buffer == null) {
          promise.resolve(emptyList<Map<String, Any>>())
          return@addOnCompleteListener
        }
        try {
          val achievements = (0 until buffer.count).map { index -> achievementMap(buffer.get(index)) }
          promise.resolve(achievements)
        } finally {
          buffer.release()
        }
      }
    }

    AsyncFunction("reportAchievement") { achievementId: String, percentComplete: Double, promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      if (percentComplete < 100) {
        promise.reject(
          "FEATURE_UNSUPPORTED",
          "Play Games needs achievement step metadata for progress below 100 percent. Use incrementAchievement for incremental achievements.",
          null,
        )
        return@AsyncFunction
      }
      PlayGames.getAchievementsClient(activity).unlockImmediate(achievementId).addOnCompleteListener { task ->
        if (task.isSuccessful) promise.resolve() else rejectProviderError(promise, "Could not unlock the Play Games achievement.", task.exception)
      }
    }

    AsyncFunction("incrementAchievement") { achievementId: String, steps: Int, promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      PlayGames.getAchievementsClient(activity).incrementImmediate(achievementId, steps).addOnCompleteListener { task ->
        if (task.isSuccessful) promise.resolve() else rejectProviderError(promise, "Could not increment the Play Games achievement.", task.exception)
      }
    }

    AsyncFunction("showAchievements") { promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      PlayGames.getAchievementsClient(activity).achievementsIntent.addOnCompleteListener { task ->
        if (!task.isSuccessful) {
          rejectProviderError(promise, "Could not open Play Games achievements.", task.exception)
          return@addOnCompleteListener
        }
        activity.startActivityForResult(task.result, ACHIEVEMENTS_UI_REQUEST_CODE)
        promise.resolve()
      }
    }

    AsyncFunction("loadLeaderboardMetadata") { leaderboardIds: List<String>?, promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      val client = PlayGames.getLeaderboardsClient(activity)
      client.loadLeaderboardMetadata(true).addOnCompleteListener { result ->
        if (!result.isSuccessful) {
          rejectProviderError(promise, "Could not load Play Games leaderboards.", result.exception)
          return@addOnCompleteListener
        }
        val buffer = result.result.get()
        if (buffer == null) {
          promise.resolve(emptyList<Map<String, Any>>())
          return@addOnCompleteListener
        }
        try {
          val requestedIDs = leaderboardIds?.toSet()
          promise.resolve(
            (0 until buffer.count)
              .map { index -> leaderboardMap(buffer.get(index)) }
              .filter { requestedIDs == null || it["id"] in requestedIDs },
          )
        } finally {
          buffer.release()
        }
      }
    }

    AsyncFunction("loadLeaderboardScores") { request: Map<String, Any?>, promise: Promise ->
      loadLeaderboardScores(request, false, promise)
    }

    AsyncFunction("loadCurrentPlayerScore") { request: Map<String, Any?>, promise: Promise ->
      loadLeaderboardScores(request, true, promise)
    }

    AsyncFunction("submitLeaderboardScore") { leaderboardId: String, score: Long, context: String?, promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      PlayGames.getLeaderboardsClient(activity).submitScoreImmediate(leaderboardId, score, context ?: "").addOnCompleteListener { task ->
        if (task.isSuccessful) promise.resolve() else rejectProviderError(promise, "Could not submit the Play Games score.", task.exception)
      }
    }

    AsyncFunction("showLeaderboards") { options: Map<String, Any?>, promise: Promise ->
      val activity = requireActivity(promise) ?: return@AsyncFunction
      val leaderboardId = options["leaderboardId"] as? String
      if (leaderboardId.isNullOrBlank()) {
        PlayGames.getLeaderboardsClient(activity).allLeaderboardsIntent.addOnCompleteListener { task ->
          launchIntent(activity, task.isSuccessful, task.result, task.exception, promise)
        }
      } else {
        PlayGames.getLeaderboardsClient(activity).getLeaderboardIntent(leaderboardId).addOnCompleteListener { task ->
          launchIntent(activity, task.isSuccessful, task.result, task.exception, promise)
        }
      }
    }
  }

  private fun withAuthenticationState(promise: Promise) {
    val activity = requireActivity(promise) ?: return
    PlayGames.getGamesSignInClient(activity).isAuthenticated.addOnCompleteListener { authenticationTask ->
      if (!authenticationTask.isSuccessful) {
        rejectProviderError(promise, "Could not determine Play Games authentication state.", authenticationTask.exception)
        return@addOnCompleteListener
      }
      if (!authenticationTask.result.isAuthenticated) {
        val state = mapOf("status" to "unauthenticated", "platform" to "playGames")
        sendEvent("onAuthenticationStateChanged", state)
        promise.resolve(state)
        return@addOnCompleteListener
      }
      PlayGames.getPlayersClient(activity).currentPlayer.addOnCompleteListener { playerTask ->
        if (!playerTask.isSuccessful) {
          rejectProviderError(promise, "Could not load the Play Games player.", playerTask.exception)
          return@addOnCompleteListener
        }
        val state = mapOf("status" to "authenticated", "platform" to "playGames", "player" to playerMap(playerTask.result))
        sendEvent("onAuthenticationStateChanged", state)
        promise.resolve(state)
      }
    }
  }

  private fun loadLeaderboardScores(request: Map<String, Any?>, currentPlayerOnly: Boolean, promise: Promise) {
    val leaderboardId = request["leaderboardId"] as? String
    if (leaderboardId.isNullOrBlank()) {
      promise.reject("INVALID_ARGUMENT", "leaderboardId is required.", null)
      return
    }
    val activity = requireActivity(promise) ?: return
    val client = PlayGames.getLeaderboardsClient(activity)
    val timeScope = timeScope(request["timeScope"] as? String)
    val collection = collection(request["collection"] as? String)
    if (currentPlayerOnly) {
      client.loadCurrentPlayerLeaderboardScore(leaderboardId, timeScope, collection).addOnCompleteListener { task ->
        if (!task.isSuccessful) {
          rejectProviderError(promise, "Could not load the current Play Games score.", task.exception)
          return@addOnCompleteListener
        }
        val score = task.result.get()
        promise.resolve(scoreResponse(leaderboardId, listOfNotNull(score?.let { scoreMap(leaderboardId, it) })))
      }
      return
    }
    val range = (request["range"] as? Number)?.toInt()?.coerceIn(1, 25) ?: 25
    val forceReload = request["forceReload"] as? Boolean ?: false
    client.loadTopScores(leaderboardId, timeScope, collection, range, forceReload).addOnCompleteListener { task ->
      if (!task.isSuccessful) {
        rejectProviderError(promise, "Could not load Play Games leaderboard scores.", task.exception)
        return@addOnCompleteListener
      }
      val leaderboardScores = task.result.get()
      if (leaderboardScores == null) {
        promise.resolve(scoreResponse(leaderboardId, emptyList()))
        return@addOnCompleteListener
      }
      val scores = leaderboardScores.scores
      try {
        promise.resolve(scoreResponse(leaderboardId, (0 until scores.count).map { index -> scoreMap(leaderboardId, scores.get(index)) }))
      } finally {
        scores.release()
      }
    }
  }

  private fun requireActivity(promise: Promise) = appContext.currentActivity ?: run {
    promise.reject("PRESENTATION_UNAVAILABLE", "An Android activity is required for Play Games Services.", null)
    null
  }

  private fun playerMap(player: Player) = mapOf("id" to player.playerId, "displayName" to player.displayName, "alias" to player.title)

  private fun achievementMap(achievement: Achievement) = mapOf(
    "id" to achievement.achievementId,
    "title" to achievement.name,
    "description" to achievement.description,
    "percentComplete" to achievementProgress(achievement),
    "isUnlocked" to (achievement.state == Achievement.STATE_UNLOCKED),
  )

  private fun leaderboardMap(leaderboard: Leaderboard) = mapOf(
    "id" to leaderboard.leaderboardId,
    "title" to leaderboard.displayName,
    "sortOrder" to "descending",
  )

  private fun scoreMap(leaderboardId: String, score: LeaderboardScore) = mapOf(
    "leaderboardId" to leaderboardId,
    "rank" to score.rank,
    "score" to score.rawScore,
    "formattedScore" to score.displayScore,
    "player" to mapOf("id" to (score.scoreHolder?.playerId ?: score.scoreHolderDisplayName), "displayName" to score.scoreHolderDisplayName),
    "timestamp" to isoDate(score.timestampMillis),
  )

  private fun scoreResponse(leaderboardId: String, scores: List<Map<String, Any>>) = mapOf(
    "leaderboard" to mapOf("id" to leaderboardId, "title" to leaderboardId, "sortOrder" to "descending"),
    "scores" to scores,
  )

  private fun achievementProgress(achievement: Achievement): Double {
    if (achievement.state == Achievement.STATE_UNLOCKED) return 100.0
    if (achievement.type != Achievement.TYPE_INCREMENTAL) return 0.0
    return (achievement.currentSteps.toDouble() / achievement.totalSteps.coerceAtLeast(1) * 100).coerceIn(0.0, 100.0)
  }

  private fun isoDate(timestampMillis: Long): String {
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date(timestampMillis))
  }

  private fun timeScope(value: String?) = when (value) {
    "today" -> LeaderboardVariant.TIME_SPAN_DAILY
    "week" -> LeaderboardVariant.TIME_SPAN_WEEKLY
    else -> LeaderboardVariant.TIME_SPAN_ALL_TIME
  }

  private fun collection(value: String?) = if (value == "friends") LeaderboardVariant.COLLECTION_FRIENDS else LeaderboardVariant.COLLECTION_PUBLIC

  private fun launchIntent(activity: android.app.Activity, successful: Boolean, intent: Intent?, error: Exception?, promise: Promise) {
    if (!successful || intent == null) {
      rejectProviderError(promise, "Could not open Play Games leaderboards.", error)
      return
    }
    activity.startActivityForResult(intent, LEADERBOARDS_UI_REQUEST_CODE)
    promise.resolve()
  }

  private fun rejectProviderError(promise: Promise, message: String, error: Exception?) {
    promise.reject("PROVIDER_ERROR", message, error)
  }

  private companion object {
    const val ACHIEVEMENTS_UI_REQUEST_CODE = 10_001
    const val LEADERBOARDS_UI_REQUEST_CODE = 10_002
  }
}
