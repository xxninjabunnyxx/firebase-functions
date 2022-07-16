import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import 'dotenv/config'
import * as express from "express";

admin.initializeApp();

const app = express();

export const api = functions.https.onRequest(app);