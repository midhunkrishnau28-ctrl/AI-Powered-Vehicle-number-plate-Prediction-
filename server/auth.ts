import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { type User as SelectUser } from "@shared/models/auth";

declare global {
    namespace Express {
        interface User extends SelectUser { }
    }
}

export function setupAuth(app: Express) {
    const sessionSettings: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || "kerala-police-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // Set to true in production with HTTPS
            maxAge: 1000 * 60 * 60 * 24, // 1 day
        },
    };

    app.use(session(sessionSettings));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                const user = await storage.getUserByUsername(username);
                if (!user || user.password !== password) {
                    return done(null, false, { message: "Invalid username or password" });
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }),
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await storage.getUser(id);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });

    // Create initial account if none exists
    (async () => {
        try {
            const admin = await storage.getUserByUsername("officer");
            if (!admin) {
                await storage.createUser({
                    username: "officer",
                    password: "password123",
                    email: "officer@keralapolice.gov.in",
                    firstName: "Intelligence",
                    lastName: "Officer",
                });
                console.log("Default account created: officer / password123");
            } else {
                console.log("Default account already exists.");
            }
        } catch (err) {
            console.error("Failed to create default account:", err);
        }
    })();
}
