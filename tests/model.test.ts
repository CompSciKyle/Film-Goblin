import postgres from "postgres";
import {
	test,
	describe,
	expect,
	afterEach,
	afterAll,
	beforeEach,
} from "vitest";
import { createUTCDate } from "../src/utils";
import User, {UserProps} from "../src/models/User"
import Genre, {genreProps} from "../src/models/Genre";
import Movie, {MovieProps} from "../src/models/Movies";
import Review, { ReviewProps} from "../src/models/Review";
import Watchlist, {WatchlistProps} from "../src/models/Watchlist";
import GenreMovie from "../src/models/GenreMovie";

describe("CRUD operations", () => {
	const sql = postgres({
		database: "MyDB",
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
	});

	//#region Users
	const createUser =  async (props: Partial<UserProps> = {}) => {
		return await User.create(sql, {
			email: props.email || "user@email.com",
			password: props.password || "password",
			createdAt: props.createdAt || createUTCDate(),
		});
	};

	test("User was created.", async () => {
		const user = await createUser({ password: "Password123", topMovie: 1},);
		await createMovie();

		expect(user.props.email).toBe("user@email.com");
		expect(user.props.password).toBe("Password123");
		expect(user.props.createdAt).toBeTruthy();
		expect(user.props.editedAt).toBeFalsy();
	});

	test("User was not created with duplicate email.", async () => {
		await createUser({ email: "user@email.com" });

		await expect(async () => {
			await createUser({ email: "user@email.com" });
		}).rejects.toThrow("User with this email already exists.");
	});

	test("User was logged in.", async () => {
		const user = await createUser({ password: "Password123" });
		const loggedInUser = await User.login(
			sql,
			user.props.email,
			"Password123",
		);

		expect(loggedInUser?.props.email).toBe("user@email.com");
		expect(loggedInUser?.props.password).toBe("Password123");
	});

	test("User was not logged in with invalid password.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, user.props.email, "wrongpassword");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was not logged in with invalid email.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, "invalid@email.com", "password");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was not logged in with invalid email and password.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, "invalid@email.com", "wrongpassword");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was updated.", async () => {
		const user = await createUser({ password: "Password123" });
		const oldPassword = user.props.password;

		await user.update({
			email: "updated@email.com",
			password: "newpassword",
		});

		expect(user.props.email).toBe("updated@email.com");
		expect(user.props.password).toBe("newpassword");
		expect(user.props.password).not.toBe(oldPassword);
		expect(user.props.editedAt).toBeTruthy();
	});

	test("User was not updated with duplicate email.", async () => {
		const user1 = await createUser({ email: "user1@email.com" });
		const user2 = await createUser({ email: "user2@email.com" });

		await expect(async () => {
			await user2.update({ email: "user1@email.com" });
		}).rejects.toThrow("User with this email already exists.");

		expect(user2.props.email).not.toBe(user1.props.email);
	});

	test("User was updated with profile picture.", async () => {
		const user = await createUser();
		const profile = "https://picsum.photos/id/238/100";

		await user.update({ profile });

		expect(user.props.profile).toBe(profile);
	});

	test("Users were listed", async () => { 
		const one = await createUser();
		const two = await createUser({email: "lol@gmail.com", password: "hi"});

		const users = await User.readAll(sql);

		expect(users).toBeInstanceOf(Array);
		expect(users).toContainEqual(one);
		expect(users).toContainEqual(two);
	});

	test("Users was searched", async () => { 
		const one = await createUser();
		const two = await createUser({email: "lol@gmail.com", password: "hi"});

		const users = await User.search(sql, "lol@gmail.com");

		expect(users?.id).toBe(two.props.id);
	});


	//#endregion

	//#region Genre
	test("Genre was created.", async () => {
		const genre = await Genre.create(sql, {
			name: "Action",
		});

		expect(genre.props.id).toBe(1);
		expect(genre.props.name).toBe("Action");
	});

	test("Genre was retrieved.", async () => {
		const genre = await Genre.create(sql, {
			name: "Action",
		});

		const read = await Genre.read(sql, genre.props.id!);
		expect(read?.props.id).toBe(1);
		expect(read?.props.name).toBe("Action");

	});
	//#endregion

	//#region Movies
	const createMovie = async (props: Partial<MovieProps> = {}) => {
		const movieProps: MovieProps = {
			name: props.name || "Test Movie",
			director: props.director || "Test Person",
			userId: props.userId || 1,
		};

		return await Movie.create(sql, movieProps);
	};

	test("Movie was created.", async () => {
		await createUser();
		const movie = await createMovie( {name: "Hi", director: "Kainath"});
		expect(movie.props.name).toBe("Hi");
		expect(movie.props.director).toBe("Kainath");
		expect(movie.props.userId).toBe(1);
	});

	test("Movie was retrieved.", async () => {
		await createUser();
		const movie = await createMovie();
		const read = await Movie.read(sql, movie.props.id!);

		expect(read?.props.name).toBe("Test Movie");
		expect(read?.props.director).toBe("Test Person");
		expect(read?.props.userId).toBe(1);
	});

	test("Movie was not retrieved.", async () => {
		await createUser();
		
		const read = await Movie.read(sql, 68);
		expect(read).toBeNull();
	})

	test("Movies were listed", async () => { 
		await createUser();
		const one = await createMovie();
		const two = await createMovie();
		const three = await createMovie();

		const movies = await Movie.readAll(sql, 1);

		expect(movies).toBeInstanceOf(Array);
		expect(movies).toContainEqual(one);
		expect(movies).toContainEqual(two);
		expect(movies).toContainEqual(three);
	});

	test("Movie was updated.", async () => {
		await createUser();
		const movie = await createMovie();
		await movie.update({name: "LOL"});
		const updated = await Movie.read(sql, movie.props.id!);

		expect(updated).not.toBeNull();
		expect(updated?.props.name).toBe("LOL");
	});

	test("Movie was deleted.", async () => {
		await createUser();
		const movie = await createMovie();

		await movie.delete();

		const deleted = await Movie.read(sql, movie.props.id!);

		expect(deleted).toBeNull();
	});

	test("Top 5 movies are retrieved.", async () => {
		await createUser();
		await createMovie({name: "Hi", director: "Lol"}); //1
		await createMovie(); //2
		await createMovie({name: "Kyle", director: "Kainath"}); //3

		await createReview({comment: "Good", rating: 6, movieId: 1});
		await createReview({comment: "Good", rating: 4, movieId: 2});
		await createReview({comment: "Good", rating: 8, movieId: 3});
		
		const top = await Movie.topMovies(sql, 1);
		
		const topMovies = [
			{id: 3, name: "Kyle", director: "Kainath"},
			{id: 1, name: "Hi", director: "Lol"},
			{id: 2, name: "Test Movie", director: "Test Person"}
		]
		
		expect(top).toHaveLength(3);
		top.forEach((movie, index) => {
			expect(movie.props.id).toBe(topMovies[index].id);
			expect(movie.props.name).toBe(topMovies[index].name);
			expect(movie.props.director).toBe(topMovies[index].director);
		});
		
	})
		
	test("Movie exists.", async () => {
			await createUser();
			const movie = await createMovie({name: "hi", director:"kyle"});
			const movie2 = await createMovie();

			const exists = await Movie.MovieExists(sql, movie.props.director, movie.props.name);
	
			expect(exists).not.toBeNull();
			expect(exists?.props.name).toBe(movie.props.name);
			expect(exists?.props.director).toBe(movie.props.director);
	});

	test("Movie doesn't exists.", async () => {
			await createUser();
			const movie = await createMovie();
			const movie2 = await createMovie();

			const exists = await Movie.MovieExists(sql, movie.props.name!, movie.props.director);
	
			expect(exists).toBeNull();

	});
	//#endregion

	//#region Review
	const createReview = async (props: Partial<ReviewProps> = {}) => {
		const reviewProps: ReviewProps = {
			comment: props.comment || "Test",
			rating: props.rating || 5,
			movieId: props.movieId || 1,
		};

		return await Review.create(sql, reviewProps);
	};

	test("Review was created.", async () => {
		await createUser();
		await createMovie();
		const review = await createReview( {comment: "Hi", rating: 10});
		expect(review.props.comment).toBe("Hi");
		expect(review.props.rating).toBe(10); 
		expect(review.props.movieId).toBe(1);
	});

	test("Review was retrieved.", async () => {
		await createUser();
		await createMovie();
		const review = await createReview();
		const read = await Review.read(sql, review.props.id!);

		expect(read?.props.comment).toBe("Test");
		expect(read?.props.rating).toBe(5);
		expect(read?.props.movieId).toBe(1);
	});

	test("Review was not retrieved.", async () => {
		await createUser();
		await createMovie();
		const read = await Review.read(sql, 43);

		expect(read).toBeNull();
	});

	test("Review was deleted.", async () => { 
		await createUser();
		await createMovie();
		const review = await createReview();

		await review.delete();

		const deleted = await Review.read(sql, review.props.id!);

		expect(deleted).toBeNull();
	});

	//#endregion

	//#region Watchlist
	const createWatchlist =  async (props: Partial<WatchlistProps> = {}) => {
		return await Watchlist.create(sql, {
			userId: props.userId || 1,
			createdAt: props.createdAt || createUTCDate(),
		});
	};

	test("Watchlist was created.", async () => {
		const user = await createUser();
		const movie = await createMovie();
		const watch = await createWatchlist ({createdAt: createUTCDate(), userId: user.props.id});
		expect(watch.props.userId).toBe(user.props.id);
		expect(watch.props.createdAt).toBeTruthy();
	});

	test("Watchlist was retrieved.", async () => {
		const user = await createUser();
		const movie = await createMovie();
		const watch = await createWatchlist({createdAt: createUTCDate(), userId: user.props.id});
		await Movie.CreateWatchlistMovie(sql, watch.props.id!, movie.props)
		const read = await Watchlist.read(sql, watch.props.id!, movie.props.id!);

		expect(read?.props.userId).toBe(user.props.id);
		expect(read?.props.name).toBe(movie.props.name)
		expect(read?.props.director).toBe(movie.props.director)

	});

	test("Movie from watchlist was retrieved.", async () => {
		const user = await createUser();
		const user2 = await createUser({email: "kainathsucks@gmail.com", password: "kyleisthebest"});
		const movie = await createMovie();
		const watch = await createWatchlist({createdAt: createUTCDate(), userId: user.props.id});
		await Movie.CreateWatchlistMovie(sql, watch.props.id!, movie.props!)
		const read = await Watchlist.read(sql, watch.props.id!, movie.props.id!)

		expect(read?.props.userId).toBe(user.props.id);
		expect(read?.props.name).toBe(movie.props.name)
		expect(read?.props.director).toBe(movie.props.director)
		expect(read?.props.userId).not.toBe(user2.props.id
		)
	});

	test("Correct movies from Watchlist were listed", async () => { 
		//User1
		const user = await createUser();
		const watch = await createWatchlist({createdAt: createUTCDate(), userId: user.props.id});
		const movie = await createMovie();

		expect(watch.props.id).toBeTruthy

		await Movie.CreateWatchlistMovie(sql, watch.props.id!, movie.props!)
		
		//User 2
		const user2 = await createUser({email: "kainathsucks@gmail.com", password: "kyleisthebest"});
		const watch2 = await createWatchlist({createdAt: createUTCDate(), userId: user2.props.id});

		expect(watch2.props.id).toBeTruthy

		const movie2 = await createMovie();
		const movie3 = await createMovie();
		await Movie.CreateWatchlistMovie(sql, watch2.props.id!, movie2.props!)
		await Movie.CreateWatchlistMovie(sql, watch2.props.id!, movie3.props!)

		//Act
		const watchlist = await Watchlist.readAll(sql, watch2.props.id!);

		//Assert
		expect(watchlist).toBeInstanceOf(Array);
		expect(watchlist).toHaveLength(2)
		expect(watchlist).toContainEqual(movie2);
		expect(watchlist).toContainEqual(movie3);
	});

	test("Watchlist was all deleted", async () => {
		await createUser();
		await createMovie();
		const one = await createWatchlist();
		const two = await createWatchlist();
		const three = await createWatchlist();

		await Watchlist.deleteAll(sql);

		const deletion = await Watchlist.readAll(sql, 1); 
		expect(deletion).toHaveLength(0);
	});

	
	test("Watchlist was found", async () => {
		//User1
		const user = await createUser();
		const watch = await createWatchlist({createdAt: createUTCDate(), userId: user.props.id});
		
		//User 2
		const user2 = await createUser({email: "kainathsucks@gmail.com", password: "kyleisthebest"});
		const watch2 = await createWatchlist({createdAt: createUTCDate(), userId: user2.props.id});

		//Act
		const watchlist = await Watchlist.find(sql, user2.props.id!);

		expect(watchlist!.props.userId).toBe(user2.props.id)
	});

	test("Watchlist was not found", async () => {
		//User1
		const user = await createUser();
		const watch = await createWatchlist({createdAt: createUTCDate(), userId: user.props.id});
		
		//User 2
		const user2 = await createUser({email: "kainathsucks@gmail.com", password: "kyleisthebest"});
		const watch2 = await createWatchlist({createdAt: createUTCDate(), userId: user2.props.id});

		//Act
		const watchlist = await Watchlist.find(sql, 200!);

		expect(watchlist).toBe(null)
	});
	//#endregion

	//#region GenreMovie
	const createGenre =  async (props: Partial<genreProps> = {}) => {
		return await Genre.create(sql, {
			name: props.name || "Drama",
		});
	};

	test("Genre was added to movie and retrieved", async () => {
		await createUser();
		let genre1 = await createGenre({ name: "Comedy" });
    	let genre2 = await createGenre({ name: "Action" });

    	let movie1 = await createMovie({ name: "Movie 1" });

		await GenreMovie.addGenreToMovie(sql, genre1.props.id!, movie1.props.id!);
		await GenreMovie.addGenreToMovie(sql, genre2.props.id!, movie1.props.id!);

		let movieOne = await GenreMovie.getGenresForMovie(sql, movie1.props.id!);

		expect(movieOne).toHaveLength(2);
		expect(movieOne).toContainEqual(genre1.props);
		expect(movieOne).toContainEqual(genre2.props)
		
	});
	// #endregion

});
