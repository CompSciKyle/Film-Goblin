import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface MovieProps {
	id?: number;
    name: string;
    director: string;  
    userId: number;
    synopsis?: string;
    picture?: string;
}

export interface MovieWatchlistProps{
	watchlistId: number, //changing this to help you kyle, change it everywhere else 
	movieId: number
}


export default class Movie {
	constructor(
		private sql: postgres.Sql<any>,
		public props: MovieProps,
	) {}

	static async create(sql: postgres.Sql<any>, props: MovieProps): Promise<Movie> {
		const connection = await sql.reserve();

		const [row] = await connection<MovieProps[]>`
			INSERT INTO movie
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;

		await connection.release();

		return new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps);
	}

	static async read(sql: postgres.Sql<any>, id: number) {
		const connection = await sql.reserve();

		const [row] = await connection<MovieProps[]>`
			SELECT M.* FROM movie M 
			LEFT JOIN moviewatchlist W ON M.id = W.movie_id
			 WHERE W.movie_id IS NULL AND M.id = ${id}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps);
	}

	static async readAll(sql: postgres.Sql<any>, userId: number): Promise<Movie[]> { 
		const connection = await sql.reserve();

		const rows = await connection<MovieProps[]>`
		SELECT M.* FROM movie M 
		LEFT JOIN moviewatchlist W ON M.id = W.movie_id
		WHERE W.movie_id IS NULL`;

		await connection.release();

		return rows.map((row) => new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps),);
	}

	async update(updateProps: Partial<MovieProps>) {

		const connection = await this.sql.reserve();

		const [row] = await connection`
			UPDATE movie
			SET ${this.sql(convertToCase(camelToSnake, updateProps))}
			WHERE id = ${this.props.id}
			RETURNING *`;

		await connection.release();

		this.props = { ...this.props, ...convertToCase(snakeToCamel, row) };
	}

	async delete() {
		const connection = await this.sql.reserve();

		const result = await connection`
			DELETE FROM movie
			WHERE id = ${this.props.id}
		`;

		await connection.release();

		return result.count === 1;
	}

	static async topMovies(sql: postgres.Sql<any>, userId: number) {
		const connection = await sql.reserve();

		const rows = await connection<MovieProps[]>`
			SELECT m.*
			FROM movie m JOIN review r ON r.movie_id = m.id ORDER BY r.rating DESC LIMIT 5`;

		await connection.release();

		return rows.map((row) => new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps),);
	}

	static async CreateWatchlistMovie (sql: postgres.Sql<any>, watchId: number, movieProps: MovieProps){ 

		const connection = await sql.reserve();

			const props: MovieWatchlistProps = {movieId: movieProps.id!, watchlistId: watchId} //changed this too for u since u complained
			
			const [row] = await connection<MovieProps[]>`
			INSERT INTO moviewatchlist
			${sql(convertToCase(camelToSnake, props))}
			RETURNING *
			`;
			
			await connection.release();

			return new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps);
	}

	static async MovieExists(sql: postgres.Sql<any>, director: string, name: string) {
		const connection = await sql.reserve();

		const [row] = await connection<MovieProps[]>`
			SELECT *
			FROM movie 
			WHERE director = ${director} and name = ${name}`;

		await connection.release();

		if (!row)
		{
			return null
		}

		return new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps);
	}
}
