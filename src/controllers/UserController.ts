import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import User, { UserProps } from "../models/User";
import { createUTCDate } from "../utils";
import Cookie from "../auth/Cookie";
import Watchlist from "../models/Watchlist";
import Movie from "../models/Movies";

export default class UserController {
  private sql: postgres.Sql<any>;

  constructor(sql: postgres.Sql<any>) {
    this.sql = sql;
  }

  registerRoutes(router: Router) {
    router.post("/users", this.createUser);
    router.get("/users/:id/edit", this.editUserForm);
    router.get("/users/:id", this.getUser); //for what? idk
    router.put("/users/:id", this.updateUser);
    router.post("/search", this.SearchUsers);
  }

  getUser = async (req: Request, res: Response) => {
    const id = req.getId();
    if (isNaN(id)) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "Invalid ID",
        template: "ErrorView",
        payload: { error: "Invalid id" },
      });
      return;
    }

    let user: User | null = null;

    try {
      user = await User.read(this.sql, id);

      if (!user) {
        await res.send({
          statusCode: StatusCode.NotFound,
          message: "User not found",
          template: "ErrorView",
          payload: { error: "Not found" },
        });
        return;
      }
    } catch (error) {
      await res.send({
        statusCode: StatusCode.InternalServerError,
        message: "Internal Server Error",
        template: "ErrorView",
        payload: { error: "Internal Server Error" },
      });
      return;
    }

    await res.send({
      statusCode: StatusCode.OK,
      message: "User found",
      template: "UserView", //not made yet
      payload: {
        user: user?.props,
      },
    });
  };

  editUserForm = async (req: Request, res: Response) => {
    if (!req.session.data.userId) {
      await res.send({
        statusCode: StatusCode.Unauthorized,
        message: "Unauthorized",
        redirect: "/login",
      });
      return;
    }
    const id = req.getId();
    let user: User | null = null;
    try {
      user = await User.read(this.sql, id);
    } catch (error) {
      await res.send({
        statusCode: StatusCode.NotFound,
        message: "User not found",
        template: "ErrorView",
        payload: { error: "Not found" },
      });
      return;
    }
    let message = "";
    if (req.getSearchParams().get("success")) {
      message = "User updated successfully!";
    } else if (req.getSearchParams().get("error")) {
      message = "User with this email already exists";
    }
    await res.send({
      statusCode: StatusCode.OK,
      message: "Edit user profile",
      template: "EditProfile",
      payload: { user: user?.props, title: "Edit User", errorMessage: message },
    });
  };

  updateUser = async (req: Request, res: Response) => {
    const { email, password, profile } = req?.body;
    if (!req.session.data.userId) {
      //cannot edit if not authorized
      await res.send({
        statusCode: StatusCode.Forbidden,
        message: "Unauthorized",
        redirect: "/login",
      });
      return;
    }

    const id = req.getId();
    if (isNaN(id)) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "Invalid user ID",
      });
      return;
    }

    let user: User | null = null;

    try {
      user = await User.read(this.sql, id);
    } catch (error) {
      await res.send({
        statusCode: StatusCode.NotFound,
        message: "User not found",
        template: "ErrorView",
        payload: { error: "Not found" },
      });
      return;
    }

    const userProps: Partial<UserProps> = {};

    if (email) {
      userProps.email = email;
    } else userProps.email = user?.props.email;

    if (password) {
      userProps.password = password;
    } else userProps.password = user?.props.password;

    if (profile) {
      userProps.profile = profile;
    } else userProps.profile = user?.props.profile;

    try {
      if (email && email !== req.body.email) {
        await User.checkEmailDuplication(this.sql, userProps as UserProps);
      }
    } catch (error) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "User with this email already exists.",
        redirect: `/users/${id}/edit?error=email_exists`,
      });
      return;
    }

    try {
      await user?.update(userProps);

      await res.send({
        statusCode: StatusCode.OK,
        message: "User updated",
        payload: { user: user?.props },
        redirect: `/users/${id}/edit?success=updated`,
      });
    } catch (error) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "User with this email already exists.",
        redirect: `/users/${id}/edit?error=email_exists`,
      });
      return;
    }
  };

  createUser = async (req: Request, res: Response) => {
    const { email, password, confirmPassword } = req.body;

    if (!password) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "Missing password.",
        redirect: "/register?error=Password required",
      });
      return;
    } else if (!email) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "Missing email.",
        redirect: "/register?error=Email is required",
      });
      return;
    } else if (password != confirmPassword) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "Passwords do not match",
        redirect: "/register?error=Passwords do not match",
      });
      return;
    }

    try {
      await User.checkEmailDuplication(this.sql, req.body as UserProps);
      let props: UserProps = {
        email,
        password,
        createdAt: createUTCDate(),
      };
      const user = await User.create(this.sql, props);
      await res.send({
        statusCode: StatusCode.Created,
        message: "User created",
        payload: {
          user: user.props,
        },
        redirect: "/login",
      });
    } catch (error) {
      await res.send({
        statusCode: StatusCode.BadRequest,
        message: "User with this email already exists.",
        redirect: "/register?error=duplicate_email",
      });
      return;
    }
  };
  
  SearchUsers = async (req: Request, res: Response) => {
    if (!req.session.data.userId) {
      await res.send({
        statusCode: StatusCode.Forbidden,
        message: "Unauthorized",
        redirect: "/login",
      });
      return;
    }
    
    if(!req.body.email)
      {
        await res.send({
          statusCode: StatusCode.NotFound,
          message: "Email field is invalid",
          redirect: "/",
        });
        return;
      }
      
      try
      {
        const userId = await User.search(this.sql,req.body.email)
        
        if(!userId?.id)
        {
          await res.send({
            statusCode: StatusCode.NotFound,
            message: "UserId field is invalid",
            redirect: "/",
          });
          return; 
        }

        await res.send({
          statusCode: StatusCode.OK,
          message: "Searched successful!",
          redirect: "/movies/top",
        });

        return;
      }
      catch
      {
        await res.send({
          statusCode: StatusCode.InternalServerError,
          message: "Invalid search error",
          redirect: "/",
        });
        return;
      }
  };
}
