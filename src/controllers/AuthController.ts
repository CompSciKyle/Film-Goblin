import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import User, { UserProps } from "../models/User";
import Cookie from "../auth/Cookie";
import { Session } from "inspector";
import { title } from "process";
import { createUTCDate } from "../utils";
import { unregisterDecorator } from "handlebars";
import Watchlist from "../models/Watchlist";

export default class AuthController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

	registerRoutes(router: Router) {
		router.get("/register", this.getRegistrationForm);
		router.get("/login", this.getLoginForm);
		router.post("/login", this.login);
		router.get("/logout", this.logout);
	}

	getRegistrationForm = async (req: Request, res: Response) => {
		await res.send({
			statusCode: StatusCode.OK,
			message: "Registration form",
			template: "Registration",
			payload: {title: "REGISTER", errorMessage: req.getSearchParams().get("error")}
		});
	};


	getLoginForm = async (req: Request, res: Response) => {
		const sessionCookie = new Cookie('session_id', req.session.id); //set as soon as they're on login page
		res.setCookie(sessionCookie);
		req.session.cookie = sessionCookie;

		
		let error: string| null = ""
		const errorMessage = req.getSearchParams().get("error")
		if(errorMessage == "Email")
		{	
			error = "Email is required."
		}
		else if(errorMessage == "Password")
		{
			error = "Password is required."
		}
		else if (errorMessage == "Invalid credentials")
		{
			error = "Invalid credentials."
		}
		
		await res.send({
			statusCode: StatusCode.OK,
			message: "Login",
			payload: {title: "Login!", errorMessage: error, isLoggedIn: false},
			template: "Login",
		});
	};

	
	login = async (req: Request, res: Response) => {
		const { email, password } = req.body;

		if (!email)
		{
			res.send({
				statusCode: StatusCode.BadRequest,
				message: "Email is required.",
				redirect: "/login?error=Email"
			});
			return;
		}
		if (!password)
		{
			res.send({
				statusCode: StatusCode.BadRequest,
				message: "Password is required.",
				redirect: "/login?error=Password"
			});
			return;
		}
		else
		{
			try {
				const user = await User.login(this.sql, email, password);
				const watchlist = await Watchlist.find(this.sql, user.props.id!)

				if (!watchlist || !user)
				{
					res.send({
						statusCode: StatusCode.NotFound,
						message: "Not found!",
						redirect: "/login?error=Invalid credentials"
					}); 
				}

				const sessionCookie = new Cookie('session_id', req.session.id);
				res.setCookie(sessionCookie);
				req.session.cookie = sessionCookie;
				req.session.set('userId', user.props.id)
				req.session.set('watchId', watchlist?.props.id) //put this somewhere else
				console.log(req.session.data)


				res.send({
			    	statusCode: StatusCode.OK,
					message: "Logged in successfully!",
					payload: {title: "Login!", user: user?.props},
					redirect: "/movies",
				});

			} catch (error) {
				res.send({
					statusCode: StatusCode.BadRequest,
					message: "Invalid credentials.",
					redirect: "/login?error=Invalid credentials"
				});
			}
		}
		
	};

	logout = async (req: Request, res: Response) => {
		req.session.destroy();
		let sessionId = req.findCookie("session_id")
		if(sessionId)
		{
			sessionId.value = ""
		}
		const session = req.getSession()
		res.setCookie(new Cookie("session_id", session.id));
		res.send({
			statusCode: StatusCode.Redirect,
					message: "",
					payload: {title: "Logout", errorMessage: req.getSearchParams().get("error"), isLoggedIn: false},
					redirect: "/"
		})
	};
}
