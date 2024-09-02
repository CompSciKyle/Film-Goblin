import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import User, {UserProps} from "../models/User";
import Movie, {MovieProps} from "../models/Movies";
import { createUTCDate } from "../utils";
import Cookie from "../auth/Cookie";
import Review, {ReviewProps} from "../models/Review";
import Genre, {genreProps} from "../models/Genre";
import GenreMovie, {GenreMovieProps} from "../models/GenreMovie";

export default class MovieController {
    private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

    registerRoutes(router: Router) {
        router.get("/movies", this.getAllMovies);
		router.get("/movies/new", this.getNewMovieForm);
		router.post("/movies", this.addMovie);
		router.get("/movies/top", this.getTopMovies);

		router.get("/movies/:id/edit", this.getEditMovieForm);
		router.get("/movies/:id", this.getMovie);
		router.put("/movies/:id", this.updateMovie);
		router.delete("/movies/:id", this.deleteMovie);
	}

    getAllMovies = async (req: Request, res: Response) => {
        let movies: Movie[] = [];

		try {
			if (!req.session.data.userId) {
				await res.send({
					statusCode: StatusCode.Unauthorized,
                    message: "Unauthorized",
                    redirect: "/login",
				});
				return;
			}
			movies = await Movie.readAll(this.sql, req.session.data.userId);

		} catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
			return;
		}

		const userTodos = movies.filter((movie) => movie.props.userId === req.session.data.userId); //user ids

		const movieList = userTodos.map((movie) => {
			return {
				...movie.props,
			};
		});

		await res.send({
			statusCode: StatusCode.OK,
			message: "Movie list retrieved",
			payload: {
				title: "Movie List",
				movie: movieList,
				isLoggedIn: true, //only true if logged in
			},
			template: "MoviesView",
		});
    }

	getMovie = async (req: Request, res: Response) => {
		const id = req.getId();
		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
				template: 'ErrorView',
				payload: {error: 'Invalid id'}
			});
			return;
		}

		let review: Review | null = null;
		let movie: Movie | null = null;
		let genres: genreProps[] = []
		let uniqueGenres = []

		try {
			if (!req.session.data.userId) { 
				await res.send({
					statusCode: StatusCode.Unauthorized,
					message: "Unauthorized",
					redirect: "/login",
				});
				return;
			}
			movie = await Movie.read(this.sql, id);
			review = await Review.read(this.sql, id);
			genres = await GenreMovie.getGenresForMovie(this.sql, movie?.props.id!)

			uniqueGenres = genres.filter((genre, index, arr) => {
				// Check if the index of the current genre is equal to the index of its first occurrence based on name
				return arr.findIndex(g => g.name === genre.name) === index;
			});
			
			if (!movie) {
				await res.send({
					statusCode: StatusCode.NotFound,
					message: 'Not found',
					template: "ErrorView",
					payload: {error: 'Not found'}
				});
			}

			if (movie?.props.userId !== req.session.data.userId) { //only each user sees their own movie
				return res.send({
					statusCode: StatusCode.Forbidden,
					message: "Forbidden",
					template: "ErrorView",
					payload: {error: 'Forbidden'}
				});
			}
		} catch (error) {
			await res.send({
				statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
			return;
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "Movie retrieved",
			template: "Movie",
			payload: {
				movie: movie?.props,
				genres: uniqueGenres,
				title: movie?.props.name,
				review: review?.props,
				isLoggedIn: true,
			},
		});
	};

	getNewMovieForm = async (req: Request, res: Response) => {
		if (!req.session.data.userId) { 
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login",
			});
			return;
		}
		await res.send({
			statusCode: StatusCode.OK,
			message: "New movie form",
			template: "NewMovieForm",
			payload: { title: "New Movie", isLoggedIn: true },
		});
	};

	addMovie = async (req: Request, res: Response) => {
		let movie: Movie | null = null;

		let movieProps: MovieProps = {
			name: req.body.name,
			director: req.body.director,
			userId: req.session.data.userId
		};

		if (!movieProps.name || !movieProps.director) { 
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Request body must include name and director.",
				template: "NewMovieForm",
				payload: {
					errorMessage : "Name and director required"
				},
			});
			return;
		}

		try {
			if (!req.session.data.userId) {
				await res.send({
					statusCode: StatusCode.Unauthorized,
					message: "Unauthorized",
					redirect: "/login",
				});
				return;
			}
			movie = await Movie.create(this.sql, movieProps);
		} catch (error) {
			console.error("Error while creating todo:", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
		}

		if (!movie) {
			await res.send({
				statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: 'ErrorView',
				payload: {error: 'Not found'}
			});
		}

		await res.send({
			statusCode: StatusCode.Created,
			message: "Movie added successfully!",
			payload: { movie: movie?.props, isLoggedIn: true },
			redirect: `/movies/${movie?.props.id}`,
		});
	};

	getEditMovieForm = async (req: Request, res: Response) => {
		const id = req.getId();
		let movie: Movie | null = null;

		try {
			if (!req.session.data.userId) { 
				await res.send({
					statusCode: StatusCode.Unauthorized,
					message: "Unauthorized",
					redirect: "/login",
				});
				return;
			}
			movie = await Movie.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
			return;
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "Edit movie form",
			template: "EditFormView",
			payload: { movie: movie?.props, title: "Edit Movie" },
		});
	};

	updateMovie = async (req: Request, res: Response) => {
		const id = req.getId();
		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
				template: 'ErrorView',
				payload: {error: 'Invalid id'}
			});
			return;
		}
		const movieProps: Partial<MovieProps> = {};

		if (req.body.name) {
			movieProps.name = req.body.name;
		}

		if (req.body.director) {
			movieProps.director = req.body.director;
		}

		if (req.body.synopsis) {
			movieProps.synopsis = req.body.synopsis;
		}

		if (req.body.picture) {
			movieProps.picture = req.body.picture;
		}

		let movie: Movie | null = null;

		try {
			movie = await Movie.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: "ErrorView",
				payload: {error: 'Not found'}
			});
		}

		try {
			await movie?.update(movieProps);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "Movie updated successfully!",
			payload: { movie: movie?.props },
			redirect: `/movies/${id}`,
		});
	};

	deleteMovie = async (req: Request, res: Response) => {
		const id = req.getId();
		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
			});
			return;
		}
		let movie: Movie | null = null;

		try {
			movie = await Movie.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: 'ErrorView',
				payload: {error: 'Not found'}
			});
		}

		try {
			await movie?.delete();
		} catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "Movie deleted successfully!",
			payload: { movie: movie?.props },
			redirect: "/movies",
		});
	};

	getTopMovies = async (req: Request, res: Response) => { 
		let top: Movie[] = [];
		try {
			if (!req.session.data.userId) {
				await res.send({
					statusCode: StatusCode.Unauthorized,
                    message: "Unauthorized",
                    redirect: "/login",
				});
				return;
			}
			top = await Movie.topMovies(this.sql, req.session.data.userId);
		} catch (error) {
            await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
        }

		const movieList = top.map((movie) => {
			return {
				...movie.props,
			};
		});

		await res.send({
			statusCode: StatusCode.OK,
			message: "Movie list retrieved",
			payload: {
				title: "Top Movie List",
				movie: movieList,
				// isLoggedIn: true,
			},
			template: "MoviesView"
		});
	}





}