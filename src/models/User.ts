import postgres from "postgres";
import Watchlist from "./Watchlist";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";
import { userInfo } from "os";

export interface UserProps {
	id?: number;
	email: string;
	password: string;
	profile?: string;
	createdAt: Date;
	editedAt?: Date;
	topMovie?: number;
}

export class DuplicateEmailError extends Error {
	constructor() {
		super("User with this email already exists.");
	}
}

export class InvalidCredentialsError extends Error {
	constructor() {
		super("Invalid credentials.");
	}
}

export default class User {
	constructor(
		private sql: postgres.Sql<any>,
		public props: UserProps,
	) {}

	static async create(
		sql: postgres.Sql<any>,
		props: UserProps,
	): Promise<User> {
		const connection = await sql.reserve();
		props.createdAt = props.createdAt ?? createUTCDate();

		await this.checkEmailDuplication(sql, props);

		const [row] = await connection<UserProps[]>`INSERT INTO users ${sql(convertToCase(camelToSnake, props))} RETURNING *`;
	
		await connection.release();

		const watchlist = await Watchlist.create(sql, {userId: row.id!, createdAt: createUTCDate()})

		return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
	}
	
	static async login(
		sql: postgres.Sql<any>,
		email: string,
		password: string,
	): Promise<User> {	
		const connection = await sql.reserve();

		const [row] = await connection<UserProps[]>`
			SELECT * FROM
			users WHERE email = ${email} AND password = ${password}`;

		await connection.release();

		if(!row)
		{
			throw new InvalidCredentialsError()
		}
		
		return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
	}

	static async checkEmailDuplication(
		sql: postgres.Sql<any>,
		props: UserProps | Partial<UserProps>,
	) {
		const [existingUser] = await sql`
		SELECT * FROM
		users WHERE email = ${props.email}`;

		if (existingUser) {
			throw new DuplicateEmailError();
		}
	}
	
	static async readAll(sql: postgres.Sql<any>,) {
		try {
			const connection = await sql.reserve();
			
			const rows = await connection<UserProps[]>`
				SELECT * FROM users`;

			await connection.release();

			return rows.map((row: UserProps) => new User(sql, convertToCase(snakeToCamel, row) as UserProps));

		} catch (error) {
			console.error('Error fetching users:', error);
			throw error; 
		}
	}

	static async read(sql: postgres.Sql<any>, id: number) {
		const connection = await sql.reserve();

		const [row] = await connection<UserProps[]>`
			SELECT * FROM
			users WHERE id = ${id}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
	}

	async update(updateProps: Partial<UserProps>) {
		const connection = await this.sql.reserve();

		if (updateProps.email && updateProps.email !== this.props.email) {
			await User.checkEmailDuplication(this.sql, { email: updateProps.email });
	
			const [row] = await connection`
				UPDATE users
				SET ${this.sql(convertToCase(camelToSnake, updateProps))}, edited_at = ${createUTCDate()}
				WHERE id = ${this.props.id}
				RETURNING *
			`;
	
			await connection.release();
	
			this.props = { ...this.props, ...convertToCase(snakeToCamel, row) };
		} else {
			const [row] = await connection`
				UPDATE users
				SET ${this.sql(convertToCase(camelToSnake, updateProps))}, edited_at = ${createUTCDate()}
				WHERE id = ${this.props.id}
				RETURNING *
			`;
	
			await connection.release();
	
			this.props = { ...this.props, ...convertToCase(snakeToCamel, row) };
		}
	}

	static async search(sql: postgres.Sql<any>, email: string)
	{
		const connection = await sql.reserve();

		const [id] = await connection<UserProps[]>`
			SELECT id FROM
			users WHERE email = ${email}
		`;

		await connection.release();

		if(!id)
		{
			return null
		}
		return id
	}

}

		


