const DEFAULT_CHECK_INTERVAL_MINUTES = 60;

const startNewsScheduler = ({ port }) => {
  const enabled =
    String(process.env.ENABLE_NEWS_SCHEDULER || "")
      .trim()
      .toLowerCase() === "true";

  if (!enabled) {
    console.log(
      "[News Scheduler] Disabled. Set ENABLE_NEWS_SCHEDULER=true to enable it."
    );
    return null;
  }

  const cronSecret = process.env.NEWS_CRON_SECRET;

  if (!cronSecret) {
    console.error(
      "[News Scheduler] Cannot start: NEWS_CRON_SECRET is missing."
    );
    return null;
  }

  const configuredMinutes = Number(
    process.env.NEWS_SCHEDULER_CHECK_INTERVAL_MINUTES
  );

  const checkIntervalMinutes =
    Number.isFinite(configuredMinutes) &&
    configuredMinutes >= 1
      ? configuredMinutes
      : DEFAULT_CHECK_INTERVAL_MINUTES;

  const checkIntervalMs =
    checkIntervalMinutes * 60 * 1000;

  const endpoint =
    `http://127.0.0.1:${port}/api/news/process-scheduled`;

  let checkInProgress = false;

  const checkSchedule = async () => {
    if (checkInProgress) {
      console.log(
        "[News Scheduler] Previous check is still running; skipping this check."
      );
      return;
    }

    checkInProgress = true;

    try {
      console.log(
        "[News Scheduler] Checking whether news processing is due..."
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-cron-secret": cronSecret,
          Accept: "application/json",
        },
      });

      const responseText = await response.text();

      let payload = {};

      try {
        payload = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        payload = {
          message: responseText || "No response body",
        };
      }

      if (!response.ok) {
        console.error(
          "[News Scheduler] Endpoint returned an error:",
          response.status,
          payload
        );
        return;
      }

      if (payload.skipped) {
        console.log(
          "[News Scheduler] No processing needed:",
          payload.reason
        );

        if (payload.nextDueAt) {
          console.log(
            "[News Scheduler] Next due time:",
            payload.nextDueAt
          );
        }

        return;
      }

      console.log(
        "[News Scheduler] Processing response:",
        JSON.stringify(
          {
            message: payload.message,
            schedule: payload.schedule,
            candidatesSentToAI: payload.candidatesSentToAI,
            alreadyTrackedSkipped:
              payload.alreadyTrackedSkipped,
            risksSaved: payload.risksSaved,
            risksAlreadyExist: payload.risksAlreadyExist,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(
        "[News Scheduler] Schedule check failed:",
        error.message
      );
    } finally {
      checkInProgress = false;
    }
  };

  // Wait for the first interval before checking.
  // This avoids automatically triggering processing on every startup.
  const timer = setInterval(
    checkSchedule,
    checkIntervalMs
  );

  // The timer should not, by itself, prevent Node from exiting.
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  console.log(
    `[News Scheduler] Enabled. Checking every ${checkIntervalMinutes} minute(s).`
  );

  console.log(
    "[News Scheduler] News processing will only start when the saved MongoDB schedule says it is due."
  );

  return timer;
};

module.exports = {
  startNewsScheduler,
};