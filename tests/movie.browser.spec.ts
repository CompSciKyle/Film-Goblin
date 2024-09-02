import postgres from "postgres";
import { test, expect, Page } from "@playwright/test";
import { getPath } from "../src/url";
import { createUTCDate } from "../src/utils";
import User, { UserProps } from "../src/models/User";
import Movie, {MovieProps} from "../src/models/Movies"
import Genre, { genreProps } from "../src/models/Genre";
import Review, {ReviewProps} from "../src/models/Review";

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

const createGenre =  async (props: Partial<genreProps> = {}) => {
    return await Genre.create(sql, {
        name: props.name || "Drama",
    });
};

const login = async (
	page: Page,
	email: string = "user@email.com",
	password: string = "password",
) => {
	await page.goto(`/login`);
	await page.fill('form#login-form input[name="email"]', email);
	await page.fill('form#login-form input[name="password"]', password);
	await page.click("form#login-form #login-form-submit-button");
};

test.afterEach(async ({ page }) => {
	const tables = ["users", "movie", "review", "genre", "watchlist", "genremovie", "moviewatchlist"];

	try {
		for (const table of tables) {
			await sql.unsafe(`DELETE FROM ${table}`);
			await sql.unsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`);
		}
	} catch (error) {
		console.error(error);
	}
});

test("Movies were displayed, no movies found", async ({page}) => {
    await createUser();
	await login(page);

	expect(await page?.url()).toBe(getPath("movies"));
    expect(await page?.textContent("body")).toMatch("No movies found");
});

test("All movies not retrieved while logged out.", async ({ page }) => {
	await createUser();
	await createMovie();

	await page.goto(`movies`);

	expect(await page?.url()).toBe(getPath("login"));
});

test("Movie was added to user", async ({page}) => {
    await createUser();
    await login(page);

	expect(await page?.url()).toBe(getPath("movies"));

    await page.goto(`/movies/new`);

    await page.fill('form#new-movie-form input[name="name"]', "Test Movie");
    await page.fill('form#new-movie-form input[name="director"]', "Test Director");
    await page.click("form#new-movie-form #new-movie-form-submit-button");
    expect(await page?.url()).toBe(getPath("movies/1"));
	expect(await page.textContent(".movie-info h1")).toContain("Test Movie");
    expect(await page.textContent(".movie-info h2")).toContain("Test Director");
});

test("Error message displayed for missing input", async ({ page }) => {
    await createUser();
    await login(page);

    await page.goto(getPath("movies/new"));

    await page.click("form#new-movie-form #new-movie-form-submit-button");
    expect(await page.textContent("h1 + h1")).toContain("Name and director required");
});

test("Invalid movie ID sends to error page", async ({ page }) => {
    await createUser();
    await login(page);

    await page.goto(getPath("movies/abc"));
    expect(await page.textContent("p")).toContain("Invalid id");
});

test("Movie not retrieved while logged out.", async ({ page }) => {
    await createUser();
	const movie = await createMovie();

	await page.goto(`movies/${movie.props.id}`);

	expect(await page?.url()).toBe(getPath("login"));
});

test("All movies were displayed", async ({ page }) => {
	await createUser();
	await login(page);
	const movies = [await createMovie(), await createMovie(), await createMovie()];

	await page.goto('movies');

	expect(await page.textContent("#movies h1")).toContain("Movies");

	for (let i = 0; i < movies.length; i++) {
        expect(await page.textContent(`#movie li:nth-child(${i + 1})`)).toContain(movies[i].props.name);
    }
});

test("Read one movie without any review or genre", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director" });

    await page.goto(getPath(`movies/${movie.props.id}`));

    expect(await page.textContent(".movie-info h1")).toContain(`Movie: ${movie.props.name}`);
    expect(await page.textContent(".movie-info h2")).toContain(`Director: ${movie.props.director}`);
    expect(await page.textContent(".review-section h2")).toContain("No reviews available");
    expect(await page.textContent(".genre-list h3")).toContain("No genres added");
});

test("Add review to a movie", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director" });

    await page.goto(getPath(`movies/${movie.props.id}`));

    const review = await createReview();

    await page.goto(getPath(`movies/${movie.props.id}`));
	expect(await page.textContent(".review-section h2")).toContain(`Comment: ${review.props.comment}`);
});

test("Review form displayed", async ({ page }) => {
	await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director" });
	await page.goto(getPath(`movies/${movie.props.id}/review`));

	await page.fill('textarea#comment', "Great movie!");
    await page.fill('input#rating', "9");

    await page.click('form[action*="review"] input[type="submit"]');

    await page.goto(getPath(`movies/${movie.props.id}`));

    expect(await page.textContent(".review-section h1")).toContain("Review:");
    expect(await page.textContent(".review-section h2")).toContain("Comment: Great movie!");
	expect(await page.textContent(".review-section h2 + h2")).toContain("Rating: 9");

});

test("Add genre to a movie", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director" });

    await page.goto(getPath(`movies/${movie.props.id}`));

    const genre = await createGenre({ name: "Comedy" });
    await page.selectOption("#genre-select", genre.props.name);
    await page.click("#new-genre-form-submit-button");

    await page.goto(getPath(`movies/${movie.props.id}`));

    expect(await page.textContent(".genre-list li")).toContain(genre.props.name);
});

test("Movie was updated", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director", synopsis: "Test Synopsis" });
	
    await page.goto(getPath(`movies/${movie.props.id}/edit`));

    await page.fill('input#name', "Edited Test Movie");
    await page.fill('input#director', "Edited Test Director");
    await page.fill('textarea#synopsis', "Edited Test Synopsis");
    await page.click('form[id="edit-movie-form"] input[type="submit"]');

    await page.goto(getPath(`movies/${movie.props.id}`));

    expect(await page.textContent(".movie-info h1")).toContain("Edited Test Movie");
    expect(await page.textContent(".movie-info h2")).toContain("Director: Edited Test Director");
    expect(await page.textContent(".movie-info h2 + h2")).toContain("Synopsis: Edited Test Synopsis");
});

test("Delete review", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director" });
    const review: Review = await createReview({ comment: "Test Comment", rating: 5, movieId: movie.props.id });
    await page.goto(getPath(`movies/${movie.props.id}`));

    await page.click("form#delete-review button[type='submit']");

    expect(await page.textContent(".review-section h2")).toContain("No reviews available");
});

test("Delete movie", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director" });
    await page.goto(getPath(`movies/${movie.props.id}`));

    await page.click("form#delete-movie-form button[type='submit']");

    expect(await page?.url()).toBe(getPath("movies"));
	expect(await page?.textContent("body")).toMatch("No movies found");
});

test("Display top movies", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movies: Movie[] = [];
    for (let i = 0; i < 5; i++) {
        const movie: Movie = await createMovie({ name: `Movie ${i}`, director: "Test Director" });
        movies.push(movie);
        await createReview({ comment: `Review for Movie ${i}`, rating: i + 1, movieId: movie.props.id });
    }

    await page.goto(getPath("movies/top"));
    expect(await page.textContent("#movies h1")).toContain("Movies");

    const movieElements = await page.$$("#movie li");

    for (let i = 0; i < 5; i++) {
        const movieName = await movieElements[i]?.textContent();
        expect(movieName).toContain(`Movie ${4 - i}`); // Movies should be from best to lowest rated
    }
});

test("Add movie to watchlist", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movie: Movie = await createMovie({ name: "Test Movie", director: "Test Director" });

    await page.goto(getPath("watchlist/new"));

    await page.fill('form#new-movie-form input[name="name"]', movie.props.name);
    await page.fill('form#new-movie-form input[name="director"]', movie.props.director);
    await page.click("form#new-movie-form #new-movie-form-submit-button");

    expect(await page.textContent(".movie-item")).toContain(movie.props.name);
});

test("View watchlist", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const movies = [
        await createMovie({ name: "Test Movie 1", director: "Test Director 1" }),
        await createMovie({ name: "Test Movie 2", director: "Test Director 2" }),
        await createMovie({ name: "Test Movie 3", director: "Test Director 3" })
    ];

    for (const movie of movies) {
        await page.goto(getPath("watchlist/new"));
        await page.fill('form#new-movie-form input[name="name"]', movie.props.name);
        await page.fill('form#new-movie-form input[name="director"]', movie.props.director);
        await page.click("form#new-movie-form #new-movie-form-submit-button");
    }

    await page.goto(getPath("watchlist"));
    expect(await page.textContent(".movie-info h2")).toContain(movies[0].props.name);
    expect(await page.textContent(".movie-info p")).toContain(`Director: ${movies[0].props.director}`);
});

test("Delete watchlist", async ({ page }) => {
    await createUser();
    await login(page);

    expect(await page?.url()).toBe(getPath("movies"));

    const movies = [
        await createMovie({ name: "Test Movie 1", director: "Test Director 1" }),
        await createMovie({ name: "Test Movie 2", director: "Test Director 2" }),
        await createMovie({ name: "Test Movie 3", director: "Test Director 3" })
    ];

    for (const movie of movies) {
        await page.goto(getPath("watchlist/new"));
        await page.fill('form#new-movie-form input[name="name"]', movie.props.name);
        await page.fill('form#new-movie-form input[name="director"]', movie.props.director);
        await page.click("form#new-movie-form #new-movie-form-submit-button");
    }
    await page.goto(getPath("watchlist"));

    expect(await page.textContent(".movie-info")).not.toBeNull();

    await page.click("form#delete-watchlist-movie #delete-movie-form-submit-button");
    expect(await page.goto("/"));

    await page.goto(getPath("watchlist"));
    expect(await page.textContent("body")).toContain("No movies found");
});

test("Search a user for their top movies", async ({ page }) => {
    const user1 = await createUser({ email: "user1@example.com" });
    const user2 = await createUser({ email: "user2@example.com" });

    await login(page, user2.props.email);

    const movies: Movie[] = [];
    for (let i = 0; i < 5; i++) {
        const movie: Movie = await createMovie({ name: `Movie ${i}`, director: "Test Director", userId: user1.props.id });
        movies.push(movie);
        await createReview({ comment: `Review for Movie ${i}`, rating: i + 1, movieId: movie.props.id });
    }

    await page.goto(getPath("movies"));

    const userEmail = "user1@example.com"; // Enter user1's email here
    await page.fill('input[name="email"]', userEmail);
    await page.click('button[type="submit"]');

    expect(await page.url()).toBe(getPath("movies/top"));

    for (let i = 5; i < movies.length; i--) {
        const movieName = await page.textContent(`#movie li:nth-child(${i + 1}) strong`);
        expect(movieName).toContain(`Movie ${i}`);
    }
});

test("Search with invalid email goes back to homepage", async ({ page }) => {
    await createUser();
    await login(page);
    expect(await page?.url()).toBe(getPath("movies"));

    const invalidEmail = "";
    await page.fill('input[name="email"]', invalidEmail);
    await page.click('button[type="submit"]');

    expect(await page.url()).toBe(getPath("")); // home page
});

