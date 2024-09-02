import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import User, {UserProps} from "../models/User";
import Movie, {MovieProps} from "../models/Movies";
import Review, {ReviewProps} from "../models/Review";
import { createUTCDate } from "../utils";
import Cookie from "../auth/Cookie";

export default class ReviewController {
    private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

    registerRoutes(router: Router) {
        router.get("/movies/:id/review", this.getAddReviewForm);
        router.post("/movies/:id/review", this.addReview);
        router.delete("/movies/:id/review", this.deleteReview);

		// Any routes that include an `:id` parameter should be registered last.
	}

    deleteReview = async (req: Request, res: Response) => {
		const id = req.getId();
		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
			});
			return;
		}
		let review: Review | null = null;

		try {
			review = await Review.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: 'ErrorView',
				payload: {error: 'Not found'}
			});
		}

		try {
			await review?.delete();
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
			message: "Review deleted successfully!",
			payload: { review: review?.props },
			redirect: `/movies/${id}`,
		});
	};

    getAddReviewForm = async (req: Request, res: Response) => {
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
			message: "New review form",
			template: "Review",
			payload: { title: "New Review", movie: movie?.props, isLoggedIn: true },
		});
	};

    addReview = async (req: Request, res: Response) => {
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

		let reviewProps: ReviewProps = {
			comment: req.body.comment,
			rating: req.body.rating,
			movieId: id
		};

		if (!reviewProps.comment || !reviewProps.rating) { 
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Request body must include comment and rating.",
				template: "Review",
				payload: { errorMessage: "Comment and rating required", movie: { id: id } },
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

			review = await Review.create(this.sql, reviewProps);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: 'Internal Server Error',
				template: 'ErrorView',
				payload: {error: 'Internal Server Error'}
			});
		}

		if (!review) {
			await res.send({
				statusCode: StatusCode.NotFound,
				message: 'Not found',
				template: 'ErrorView',
				payload: {error: 'Not found'}
			});
		}

		await res.send({
			statusCode: StatusCode.Created,
			message: "Review added successfully!",
			payload: { review: review?.props},
			redirect: `/movies/${id}`,
		});
	};
}