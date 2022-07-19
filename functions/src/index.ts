import './initFirebase'
import * as functions from "firebase-functions";
import * as express from "express";
import twitterRouter from "./controllers/twitter";

const app = express();

app.use(express.json());

app.use("/twitter", twitterRouter);

export const api = functions.https.onRequest(app);