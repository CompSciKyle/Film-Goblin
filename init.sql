DROP DATABASE IF EXISTS "MyDB";
CREATE DATABASE "MyDB";

\c MyDB;

DROP TYPE IF EXISTS genre_name;
CREATE TYPE genre_name AS ENUM ('Comedy', 'Romance', 'Action', 'Scifi', 'Horror', 'Drama', 'Thriller');

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    profile VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP
);

DROP TABLE IF EXISTS movie;
CREATE TABLE movie (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    director VARCHAR(50) NOT NULL,  
    synopsis VARCHAR(500),
    picture VARCHAR(500),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS review;
CREATE TABLE review (
    id SERIAL PRIMARY KEY,
    comment VARCHAR(500) NOT NULL,
    rating INTEGER CHECK (rating >= 0 AND rating <= 11) NOT NULL,
    movie_id INTEGER REFERENCES movie(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS watchlist;
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS moviewatchlist;
CREATE TABLE moviewatchlist (
    watchlist_id INTEGER REFERENCES watchlist(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movie(id) ON DELETE CASCADE,
    PRIMARY KEY (watchlist_id, movie_id)
);

DROP TABLE IF EXISTS genre;
CREATE TABLE genre (
    id SERIAL PRIMARY KEY,
    name genre_name NOT NULL DEFAULT 'Drama'
);

DROP TABLE IF EXISTS genremovie;
CREATE TABLE genremovie (
    genre_id INTEGER REFERENCES genre(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movie(id) ON DELETE CASCADE,
    PRIMARY KEY (genre_id, movie_id)
);