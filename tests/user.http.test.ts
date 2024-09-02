import postgres from "postgres";
import User, { UserProps } from "../src/models/User";
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

		clearCookieJar();
	});

	test("Homepage was retrieved successfully.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Homepage!");
	});

	test("Invalid path returned error.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/foo",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(false);
		expect(body.message).toBe("Invalid route: GET /foo");
	});

	test("User was created.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
				password: "password",
				confirmPassword: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("User created");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe("user@email.com");
		expect(body.payload.user.password).toBe("password");
		expect(body.payload.user.createdAt).not.toBeNull();
		expect(body.payload.user.editedAt).toBeNull();
	});

	test("User was not created due to missing email.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				password: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Missing email.");
	});

	test("User was not created due to missing password.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Missing password.");
	});

	test("User was not created due to mismatched passwords.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
				password: "password",
				confirmPassword: "password123",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Passwords do not match");
	});

	test("User was not created due to duplicate email.", async () => {
		await createUser({ email: "user@email.com" });

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
				password: "password",
				confirmPassword: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("User with this email already exists.");
	});

	test("User was logged in.", async () => {
		const user = await createUser();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/login",
			{
				email: user.props.email,
				password: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Logged in successfully!");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe(user.props.email);
		expect(body.payload.user.password).toBe("password");
		expect(body.payload.user.createdAt).toBeTruthy();
		expect(body.payload.user.editedAt).toBeFalsy();
	});

	test("User was not logged in due to invalid email.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/login",
			{
				email: "nonexistentemail",
				password: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid credentials.");
	});

	test("User was not logged in due to invalid password.", async () => {
		const user = await createUser();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/login",
			{
				email: user.props.email,
				password: "invalidpassword",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid credentials.");
	});

	test("User was updated.", async () => {
		const user = await createUser();

		await makeHttpRequest("POST", "/login", {
			email: user.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/users/${user.props.id}`,
			{
				email: "newemail@email.com",
				password: "newpassword",
				profile: "https://picsum.photos/id/238/100",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("User updated");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe("newemail@email.com");
		expect(body.payload.user.password).toBe("newpassword");
		expect(body.payload.user.profile).toBe(
			"https://picsum.photos/id/238/100",
		);
		expect(body.payload.user.createdAt).toBeTruthy();
		expect(body.payload.user.editedAt).toBeTruthy();
	});

	test("User was not updated without being logged in.", async () => {
		await createUser();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/users/1",
			{
				email: "newemail@email.com",
				password: "newpassword",
			},
		);

		expect(statusCode).toBe(StatusCode.Forbidden);
		expect(body.message).toBe("Unauthorized");
	});

	test("User was not updated due to invalid user ID.", async () => {
		const user = await createUser();

		await makeHttpRequest("POST", "/login", {
			email: user.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/users/abc",
			{
				email: "newemail@email.com",
				password: "newpassword",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid user ID");
	});

	test("User was not updated due to duplicate email.", async () => {
		const user1 = await createUser({ email: "user1@email.com" });
		const user2 = await createUser({ email: "user2@email.com" });

		await makeHttpRequest("POST", "/login", {
			email: user1.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/users/${user1.props.id}`,
			{
				email: user2.props.email,
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("User with this email already exists.");
	});

	test("User was searched.", async () => {
		const user1 = await createUser({ email: "user1@email.com" });
		const user2 = await createUser({ email: "user2@email.com" });

		await makeHttpRequest("POST", "/login", {
			email: user1.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			`/search`,
			{
				email: user2.props.email,
			},
		);
		
		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Searched successful!");
	});

	test("User was not searched without being logged in.", async () => {
		await createUser();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/search",
			{
				email: "newemail@email.com",
			},
		);

		expect(statusCode).toBe(StatusCode.Forbidden);
		expect(body.message).toBe("Unauthorized");
	});

	test("User was searched with a email that does not exist", async () => {
		const user1 = await createUser({ email: "user1@email.com" });

		await makeHttpRequest("POST", "/login", {
			email: user1.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			`/search`,
			{
				email: "ejfm@gmail.com",
			},
		);
		
		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("UserId field is invalid");
	});

});