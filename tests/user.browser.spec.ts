import postgres from "postgres";
import { test, expect, Page } from "@playwright/test";
import { getPath } from "../src/url";
import { createUTCDate } from "../src/utils";
import User, { UserProps } from "../src/models/User";

const sql = postgres({
	database: "MyDB",
});

const createUser = async (props: Partial<UserProps> = {}) => {
	return await User.create(sql, {
		email: props.email || "user@email.com",
		password: props.password || "password",
		createdAt: props.createdAt || createUTCDate(),
	});
};

test.beforeEach(async () => {
	// Anything you want to do before each test runs?
});

/**
 * Clean up the database after each test. This function deletes all the rows
 * from the movies and submovies tables and resets the sequence for each table.
 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
 */
test.afterEach(async ({ page }) => {
	// Replace the table_name with the name of the table(s) you want to clean up.
	const tables = ["users", "movie", "review", "genre", "watchlist", "genremovie", "moviewatchlist"];

	try {
		for (const table of tables) {
			await sql.unsafe(`DELETE FROM ${table}`);
			await sql.unsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`);
		}
	} catch (error) {
		console.error(error);
	}

	// await logout(page);
});

test("Homepage was retrieved successfully", async ({ page }) => {
	await page.goto("/");

	expect(await page?.title()).toBe("Film Goblin");
});

test("User was registered.", async ({ page }) => {
	await page.goto(`register`);

	await page.fill('form#register-form input[name="email"]', "user@email.com");
	await page.fill('form#register-form input[name="password"]', "Password123");
	await page.fill(
		'form#register-form input[name="confirmPassword"]',
		"Password123",
	);
	await page.click("form#register-form #register-form-submit-button");

	expect(await page?.url()).toBe(getPath("login"));
});

test("User was not registered with blank email.", async ({ page }) => {
	await page.goto(`register`);

	await page.fill('form#register-form input[name="password"]', "Password123");
	await page.fill(
		'form#register-form input[name="confirmPassword"]',
		"Password123",
	);
	await page.click("form#register-form #register-form-submit-button");

	expect(await page?.url()).toMatch(getPath("register"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Email is required");
});

test("User was not registered with mismatched passwords.", async ({ page }) => {
	await page.goto(`register`);

	await page.fill('form#register-form input[name="email"]', "user@email.com");
	await page.fill('form#register-form input[name="password"]', "Password123");
	await page.fill(
		'form#register-form input[name="confirmPassword"]',
		"Password124",
	);
	await page.click("form#register-form #register-form-submit-button");

	expect(await page?.url()).toMatch(getPath("register"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Passwords do not match");
});

test("User was logged in.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/`);

	let loginElement = await page.$(`li a[href="${getPath("login")}"]`);
	let logoutElement = await page.$(`li a[href="${getPath("logout")}"]`);

	expect(await loginElement).toBeTruthy();
	expect(await logoutElement).toBeFalsy();

	await loginElement?.click();

	await page.fill('form#login-form input[name="email"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath("movies"));

	loginElement = await page.$(`li a[href="${getPath("login")}"]`);
	logoutElement = await page.$(`li a[href="${getPath("logout")}"]`);

	expect(await loginElement).toBeFalsy();
	expect(await logoutElement).toBeTruthy();
});

test("User was not logged in with blank email.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toMatch(getPath("login"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Email is required.");
});

test("User was not logged in with incorrect password.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="email"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password124");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toMatch(getPath("login"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Invalid credentials.");
});

test("User was logged out.", async ({ page, context }) => {
	const user = await createUser({ password: "Password123" });

	expect((await context.cookies()).length).toBe(0);

	await page.goto(`/login`);

	expect((await context.cookies()).length).toBe(1);

	await page.fill('form#login-form input[name="email"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath("movies"));

	const logoutElement = await page.$(`li a[href="${getPath("logout")}"]`);

	await logoutElement?.click();

	expect(await page?.url()).toBe(getPath(""));

	const loginElement = await page.$(`li a[href="${getPath("login")}"]`);

	expect(await loginElement).toBeTruthy();
});

test("User was updated.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="email"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath("movies"));

	await page.goto(`/users/${user.props.id}/edit`);

	await page.fill(
		'form#edit-user-form input[name="email"]',
		"updateduser@email.com",
	);
	await page.fill(
		'form#edit-user-form input[name="password"]',
		"newpassword",
	);
	await page.click("form#edit-user-form #edit-user-form-submit-button");

	expect(await page?.url()).toMatch(getPath(`users/${user.props.id}/edit`));
	expect(await page?.textContent("body")).toMatch(
		"User updated successfully!",
	);

	const updatedUser = await User.read(sql, user.props.id!);

	expect(updatedUser?.props.email).toBe("updateduser@email.com");
	expect(updatedUser?.props.password).toBe("newpassword");
	expect(updatedUser?.props.editedAt).toBeTruthy();
});

test("User was not updated with duplicate email.", async ({ page }) => {
	const user1 = await createUser({ email: "user1@email.com" });
	const user2 = await createUser({ email: "user2@email.com" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="email"]', user1.props.email);
	await page.fill('form#login-form input[name="password"]', "password");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath("movies"));

	await page.goto(`/users/${user1.props.id}/edit`);

	await page.fill(
		'form#edit-user-form input[name="email"]',
		user2.props.email,
	);

	await page.click("form#edit-user-form #edit-user-form-submit-button");

	expect(await page?.url()).toMatch(getPath(`users/${user1.props.id}/edit`));
	expect(await page?.textContent("body")).toMatch(
		"User with this email already exists",
	);
});

test("User was updated with profile picture.", async ({ page }) => {
	const user = await createUser();

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="email"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "password");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath("movies"));

	await page.goto(`/users/${user.props.id}/edit`);

	const profilePicturePath = "https://picsum.photos/id/238/100";

	await page.fill(
		'form#edit-user-form input[name="profile"]',
		profilePicturePath,
	);
	await page.click("form#edit-user-form #edit-user-form-submit-button");

	const profilePicture = await page.$("img");
	const profilePictureInput = await page.$(
		`form#edit-user-form input[name="profile"]`,
	);

	expect(await page?.url()).toMatch(getPath(`users/${user.props.id}/edit`));
	expect(await page?.textContent("body")).toMatch(
		"User updated successfully!",
	);
	expect(await profilePicture?.getAttribute("src")).toBe(profilePicturePath);
	expect(await profilePictureInput?.getAttribute("value")).toBe(
		profilePicturePath,
	);
});

//more user tests needed prob

