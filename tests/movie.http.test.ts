import postgres from "postgres";
import User, { UserProps } from "../src/models/User";
import Movie, {MovieProps} from "../src/models/Movies";
import Review, {ReviewProps} from "../src/models/Review";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeAll } from "vitest";
import { createUTCDate } from "../src/utils";
import Genre, { genreProps } from "../src/models/Genre";
import GenreMovie from "../src/models/GenreMovie";
import Watchlist, {WatchlistProps} from "../src/models/Watchlist";

describe("User HTTP operations", () => {
	const sql = postgres({
		database: "MyDB",
	});

    const server = new Server({
		host: "localhost",
		port: 3000,
		sql,
	});

	const createUser = async (props: Partial<UserProps> = {}) => {
		return await User.create(sql, {
			email: props.email || "user@email.com",
			password: props.password || "password",
			createdAt: props.createdAt || createUTCDate(),
		});
	};

    const createMovie = async (props: Partial<MovieProps> = {}) => {
        return await Movie.create(sql, {
            name: props.name || "movie",
            director: props.director || "kyle",
            userId: props.userId || 1,
        });
    };

	const createReview = async (props: Partial<ReviewProps> = {}) => {
        return await Review.create(sql, {
            comment: props.comment || "good",
            rating: props.rating || 5,
            movieId: props.movieId || 1,
        })
    };

	const createGenre =  async (props: Partial<genreProps> = {}) => {
		return await Genre.create(sql, {
			name: props.name || "Drama",
		});
	};

	const createWatchlist = async (props: Partial<WatchlistProps> = {}) => {
		return await Watchlist.create(sql, {
			userId: props.userId || 1,
			createdAt: props.createdAt || createUTCDate()
		});
	};

	const CreateWatchlistMovie = async (watchId: number, movieProps: Partial<MovieProps> = {}) => {
		return await Movie.CreateWatchlistMovie(sql, watchId || 1,
			 {name: movieProps.name || "kyle",
				director: movieProps.director || "kainath",
				userId: movieProps.userId || 1,
				id: movieProps.id || 1,
			 });
	};

    const login = async (
		email: string = "user@email.com",
		password: string = "password",
	) => {
		await makeHttpRequest("POST", "/login", {
			email,
			password,
		});
	};

	beforeAll(async () => {
		await server.start();
	});

    afterEach(async () => {
		const tables = ["users", "movie", "review", "genre", "watchlist", "genremovie", "moviewatchlist"];

		try {
			for (const table of tables) {
				await sql.unsafe(`DELETE FROM ${table}`);
				await sql.unsafe(
					`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`,
				);
			}
		} catch (error) {
			console.error(error);
		}
        await makeHttpRequest("POST", "/logout");
		clearCookieJar();
	});


	//#region Movies
	test("Movie was created.", async () => {
		let user = await createUser();
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			`/movies`,
			{
				name: "Test",
				director: "kyle",
                userId: user.props.id
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Movie added successfully!");
		expect(Object.keys(body.payload.movie).includes("id")).toBe(true);
		expect(Object.keys(body.payload.movie).includes("name")).toBe(true);
		expect(Object.keys(body.payload.movie).includes("director")).toBe(true);

		expect(body.payload.movie.id).toBe(1);
		expect(body.payload.movie.name).toBe("Test");
		expect(body.payload.movie.director).toBe("kyle");
	});

    test("Movie was not created due to missing name.", async () => {
		let user = await createUser();
        await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
            `/movies`,
			{
				director: "kyle",
                userId: user.props.id
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe(
			"Request body must include name and director.",
		);
		expect(body.payload.movie).toBeUndefined();
	});

	test("Movie was not created by unauthenticated user.", async () => {
		let user = await createUser();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
            `/movies`,
            {
				name: "Test",
				director: "kyle",
                userId: user.props.id
			},
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("Movie was deleted.", async () => {
		let user = await createUser();
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/movies/${user.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Movie deleted successfully!");
	});

    test("Movie was retrieved.", async () => {
        await createUser(); 
		await login();

		const movie = await createMovie();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/movies/${movie.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Movie retrieved");
		expect(body.payload.movie.name).toBe(movie.props.name);
		expect(body.payload.movie.director).toBe(movie.props.director);
		expect(body.payload.movie.userId).toBe(movie.props.userId);
	});

    test("Movie was not retrieved due to invalid ID.", async () => { 
        await createUser(); 
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/movies/abc",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
	});

	test("Movie was not retrieved due to non-existent ID.", async () => {
        await createUser(); 
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/movies/1",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Not found");
	});

    test("Movie was not retrieved by unauthenticated user.", async () => {
        await createUser();
		const movie = await createMovie();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/movies/${movie.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("Movie was not retrieved by another user.", async () => {
		await createUser();

		await createUser({
			email: "user2@email.com",
		});
		await login("user@email.com");

		const movie = await createMovie();

		await makeHttpRequest("POST", "/logout");
		await login("user2@email.com");

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/movies/${movie.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.Forbidden);
		expect(body.message).toBe("Forbidden");
	});

    test("Movie was updated.", async () => {
        await createUser(); 
		await login();

		const movie = await createMovie();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/movies/${movie.props.id}`,
			{
				name: "Updated movie",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Movie updated successfully!");
		expect(body.payload.movie.name).toBe("Updated movie");
		expect(body.payload.movie.director).toBe(movie.props.director);
	});

    test("Movies were listed.", async () => {
        await createUser(); 
		await login();

		const movie1 = await createMovie();
		const movie2 = await createMovie();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/movies",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Movie list retrieved");
		expect(body.payload.movie).toBeInstanceOf(Array);
		expect(body.payload.movie[0].name).toBe(movie1.props.name);
		expect(body.payload.movie[0].director).toBe(movie1.props.director);

		expect(body.payload.movie[1].name).toBe(movie2.props.name);
		expect(body.payload.movie[1].director).toBe(movie2.props.director);
	});

    test("Movies were not listed by unauthenticated user.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/movies",
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

    test("Movies were listed with top 5 ratings.", async () => {
        await createUser(); 
		await login();

		const movie1 = await createMovie();
		const movie2 = await createMovie();
        await createReview();
        await createReview({rating: 10, movieId: 2});

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/movies/top",
		);

        expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Movie list retrieved");
		expect(body.payload.movie).toBeInstanceOf(Array);

		expect(body.payload.movie[0].name).toBe(movie2.props.name);
		expect(body.payload.movie[0].director).toBe(movie2.props.director); //second movie has bigger rating

        expect(body.payload.movie[1].name).toBe(movie1.props.name);
		expect(body.payload.movie[1].director).toBe(movie1.props.director);
    });
	//#endregion

	//#region Genre
	test("Genre was created.", async () => {
		let user = await createUser();
		await login();
		const movie = await createMovie();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			`/movies/${movie.props.id}/genre`,
			{
				name: "Action",
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Genre added successfully!");
		expect(Object.keys(body.payload.genre).includes("id")).toBe(true);
		expect(Object.keys(body.payload.genre).includes("name")).toBe(true);

		expect(body.payload.genre.id).toBe(1);
		expect(body.payload.genre.name).toBe("Action");
	});

	test("Genre was not created by unauthenticated user.", async () => {
		await createUser();
		const movie = await createMovie();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
            `/movies/${movie.props.id}/genre`,
            {
				name: "Romance",
			},
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("Genre was read on the movie page.", async () => {
		await createUser();
		await login();
		const movie = await createMovie();
		const genre = await createGenre();
		await GenreMovie.addGenreToMovie(sql, genre?.props.id!, movie?.props.id!)

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/movies/${movie.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.payload.genres).toBeInstanceOf(Array);
		expect(body.payload.genres[0].name).toBe(genre.props.name);
	});
	//#endregion

	//#region Watchlist
	test("Watchlist is not accessible by unauthenticated user", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/watchlist`,
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("New movie in watchlist is not accessible by unauthenticated user", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/watchlist/new`,
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("New movie in watchlist is seen", async () => {
		const user = await createUser();
		await login();
		const movie = await createMovie();
		const watchlist = await createWatchlist();
		await CreateWatchlistMovie(watchlist.props.id!, movie as Partial<MovieProps>);
	
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/watchlist`,
		);
		
		expect(statusCode).toBe(StatusCode.OK);
		expect(Array.isArray(body.payload.movie)).toBe(true);
	});

	test("Many movies is seen in watchlist", async () => {
		const user = await createUser();
		await login();
		const watchlist = await createWatchlist();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			`/watchlist`,
			{
				name: "Action",
				director: "Kyle"
			},
		);
		
		expect(statusCode).toBe(StatusCode.Created);
		expect(Array.isArray(body.payload.movie)).toBe(true);
		expect(body.payload.movie[0]).toStrictEqual({id: 1, name: "Action", director:"Kyle", picture: null, synopsis: null, userId: 1,});

	});

	test("New movie in watchlist deleted", async () => {
		const user = await createUser();
		await login();
		const movie = await createMovie();
		const watchlist = await createWatchlist();
		await CreateWatchlistMovie(watchlist.props.id!, movie as Partial<MovieProps>);
	
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/watchlist`,
		);
		
		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Sucessfully deleted watchlist")
	});
	//#endregion



    




})
