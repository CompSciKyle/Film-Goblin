import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import User, {UserProps} from "../models/User";
import Movie, {MovieProps} from "../models/Movies";
import { createUTCDate } from "../utils";
import Cookie from "../auth/Cookie";
import Review, {ReviewProps} from "../models/Review";
import Watchlist from "../models/Watchlist";

export default class MovieController {
    private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

    registerRoutes(router: Router) {
        router.get("/watchlist", this.getAllMoviesFromWatchlist);
		router.get("/watchlist/new", this.getNewWatchlistMovieForm);
		router.post("/watchlist", this.addMovieToWatchlist);
		router.delete("/watchlist", this.deleteWatchlist);
	}

	getNewWatchlistMovieForm = async (req: Request, res: Response) => {
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
			template: "NewWatchlistMovieForm",
			payload: { title: "New Movie" },
		});
	};

    getAllMoviesFromWatchlist = async (req: Request, res: Response) => {
        let watchlistMovies: Movie[] = [];
		let movieWatchlist;

		try {
			if (!req.session.data.userId) {
				await res.send({
					statusCode: StatusCode.Unauthorized,
                    message: "Unauthorized",
                    redirect: "/login",
				});
				return;
			}
            
            watchlistMovies = await Watchlist.readAll(this.sql, req.session.data.watchId);  //Might have to change req.session.data.watchId
			movieWatchlist = watchlistMovies.map((movie) => {
				return {
					...movie.props,
				};
			});
            
		} catch (error) {
            const message = `Error while getting watchlist: ${error}`;
			console.error(message);
            
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
			message: "Watchlist retrieved",
			payload: {
				title: "Movie List",
				movie: movieWatchlist,
				isLoggedIn: true, 
			},
			template: "WatchlistView",
		});
    }


	addMovieToWatchlist = async (req: Request, res: Response) => {
		let movie: Movie | null = null;

		if (!req.body.name || !req.body.director) { 
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

		if (!req.session.data.userId) {
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login",
				});
			return;
		}	
		
		let newMovie: Movie | null = await Movie.MovieExists(this.sql, req.body.director, req.body.name)

		if(!movie || !newMovie) //changed this to fix the red underline null error
		{
			let movieProps: MovieProps = {
					name: req.body.name,
					director: req.body.director,
				 	userId: req.session.data.userId
				};

			newMovie = await Movie.create(this.sql, movieProps)
		}

        const watchlistMovie: Movie | null = await Movie.CreateWatchlistMovie(this.sql, req.session.data.watchId, newMovie.props); //req.session.data.watchId might not work
        
		if (!watchlistMovie) {
            await res.send({
                statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: 'ErrorView',
				payload: {error: 'Not found'}
			});
		}
        
        let movies: Movie[] = []


        movies = await Watchlist.readAll(this.sql, req.session.data.watchId)
		let movieWatchlist = movies.map((movie) => {
			return {
				...movie.props,
			};
		});
	


		await res.send({
			statusCode: StatusCode.Created,
			message: "Movie added to watchlist successfully!",
			payload: {movie: movieWatchlist},
			redirect: "/watchlist"
		});
	};

	deleteWatchlist = async (req: Request, res: Response) => {

		try 
        {
			await Watchlist.deleteAll(this.sql);
		} 

        catch (error) {
			console.error("Error while deleting watchlist:", error);
			await res.send({
				statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: 'ErrorView',
				payload: {error: 'Not found'}
			});
		}

        await res.send({
            statusCode: StatusCode.OK,
            message: 'Sucessfully deleted watchlist',
            redirect: "/"
        });


	};

}