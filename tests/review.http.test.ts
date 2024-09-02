import postgres from "postgres";
import User, { UserProps } from "../src/models/User";
import Movie, {MovieProps} from "../src/models/Movies";
import Review, {ReviewProps} from "../src/models/Review";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeAll } from "vitest";
import { createUTCDate } from "../src/utils";

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
    }

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

	test("Review was created.", async () => {
		await createUser();
		await login();
        let movie = await createMovie();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			`/movies/${movie?.props.id}/review`,
			{
				comment: "Test",
				rating: 1,
                movieId: movie.props.id
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Review added successfully!");
		expect(Object.keys(body.payload.review).includes("id")).toBe(true);
		expect(Object.keys(body.payload.review).includes("comment")).toBe(true);
		expect(Object.keys(body.payload.review).includes("rating")).toBe(true);

		expect(body.payload.review.id).toBe(1);
		expect(body.payload.review.comment).toBe("Test");
		expect(body.payload.review.rating).toBe(1);
	});

    test("Review was not created due to missing comment.", async () => {
		await createUser();
        await login();
        let movie = await createMovie();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
            `/movies/${movie?.props.id}/review`,
			{
				rating: 1,
                movieId: movie.props.id
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe(
			"Request body must include comment and rating.",
		);
		expect(body.payload.review).toBeUndefined();
	});

	test("Review was not created due to missing rating.", async () => {
		await createUser();
        await login();
        let movie = await createMovie();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
            `/movies/${movie?.props.id}/review`,
			{
				comment: "hi",
                movieId: movie.props.id
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe(
			"Request body must include comment and rating.",
		);
		expect(body.payload.review).toBeUndefined();
	});

	test("Review was not created by unauthenticated user.", async () => {
		await createUser();
        let movie = await createMovie();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
            `/movies/${movie?.props.id}/review`,
            {
				comment: "Test",
				rating: 1,
                movieId: movie.props.id
			},
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("Review was deleted.", async () => {
		await createUser();
		await login();
		await createMovie();

		const review = await createReview();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/movies/${review.props.movieId}/review`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Review deleted successfully!");
	});

	test("Review was not deleted due to invalid ID", async () => {
		await createUser();
		await login();
		await createMovie();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/movies/abc/review`,
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
	});

	test("Review was read on the movie page.", async () => {
		await createUser();
		await login();
		const movie = await createMovie();
		const review = await createReview();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/movies/${movie.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.payload.review.comment).toBe(review.props.comment);
		expect(body.payload.review.rating).toBe(review.props.rating);
	});

})
