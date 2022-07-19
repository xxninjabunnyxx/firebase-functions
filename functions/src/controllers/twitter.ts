import { Router } from "express";
import * as admin from "firebase-admin";
import '../initFirebase'
import 'dotenv/config'

const TwitterApi = require('twitter-api-v2').default;
const router = Router();

 type Tweet = {
  body: String,
  hashTags: String[],
  link: String
}

const clientBuilder = async (username: string) => {
  const client = new TwitterApi({
    clientId: process.env[`TWITTER_CLIENT_ID_${username}`],
    clientSecret: process.env[`TWITTER_CLIENT_SECRET_${username}`],
  })
  return client
}

const dbRefBuilder = async (username: string) => {
  return admin.firestore().doc(`/twitter/${username}`)
}

const tweetBuilder = async ({ body, hashTags, link } : Tweet): Promise<string> => {
  let tweet = `${body}`
  if (hashTags.length > 0) {
    tweet += ` #${hashTags.join(' #')}`
  }
  if (link != '') {
    tweet += ` ${link}`
  }
  return tweet
}


router.get("/:username/auth", async (req, res) => {
  const client = await clientBuilder(req.params.username)
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    process.env[`TWITTER_CALLBACK_URL_${req.params.username}`],
    { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
  )

  await (await dbRefBuilder(req.params.username)).set({ codeVerifier, state })

  res.redirect(url);
});

router.get("/:username/callback", async (req, res) => {
    const { state, code } = req.query;
    const dbRef = await dbRefBuilder(req.params.username)
    const { codeVerifier, state: storedState } = (await dbRef.get()).data() || {};

    if(state !== storedState) {
      res.status(400).send("Invalid state");
    }

    const client = await clientBuilder(req.params.username)
    const {
      accessToken,
      refreshToken,
    } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: process.env[`TWITTER_CALLBACK_URL_${req.params.username}`],
    });

    await dbRef.set({ accessToken, refreshToken });

    res.sendStatus(200);
});

router.post("/:username/tweet", async (req, res) => {
  const dbRef = await dbRefBuilder(req.params.username)
  const dbSnapshot = await dbRef.get();
  const { refreshToken } = dbSnapshot.data() || {};
  const client = await clientBuilder(req.params.username)
  const {
    client: refreshedClient,
    accessToken,
    refreshToken: newRefreshToken,
  } = await client.refreshOAuth2Token(refreshToken) || {};

  await dbRef.set({ accessToken, refreshToken: newRefreshToken });

  const tweetData: Tweet = {
    body: req.body.tweet,
    hashTags: req.body.hashTags,
    link: req.body.link,
  }
  const tweet = await tweetBuilder(tweetData)
  const { data } = await refreshedClient.v2.tweet(
    tweet,
  );
  res.send(data);
});

export default router;