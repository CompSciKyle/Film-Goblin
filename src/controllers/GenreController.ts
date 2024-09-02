import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import User, {UserProps} from "../models/User";
import Genre, {genreProps} from "../models/Genre";
import GenreMovie, {GenreMovieProps} from "../models/GenreMovie";
import Movie, {MovieProps} from "../models/Movies";
import { createUTCDate } from "../utils";
import Cookie from "../auth/Cookie";

export default class GenreController {
    private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

    registerRoutes(router: Router) {
        router.post("/movies/:id/genre", this.addGenreToMovie);

		// Any routes that include an `:id` parameter should be registered last.
	}

    addGenreToMovie = async (req: Request, res: Response) => {
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

        let genre: Genre | null = null;
        let movie: Movie | null = null;

		let genreProps: genreProps = {
			name: req.body.name,
		};

        try {
			if (!req.session.data.userId) {
				await res.send({
					statusCode: StatusCode.Unauthorized,
					message: "Unauthorized",
					redirect: "/login",
				});
				return;
			}
			genre = await Genre.create(this.sql, genreProps);
            movie = await Movie.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
		}

        await GenreMovie.addGenreToMovie(this.sql, genre?.props.id!, movie?.props.id!)
        await res.send({
			statusCode: StatusCode.Created,
			message: "Genre added successfully!",
			payload: { genre: genre?.props },
			redirect: `/movies/${id}`,
		});
    }
}