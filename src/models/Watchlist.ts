import postgres from "postgres";
import Movie, { MovieWatchlistProps } from "./Movies";
import { MovieProps } from "./Movies";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface WatchlistProps {
	id?: number;
	userId: number;
	createdAt: Date;
}

export default class Watchlist {
	constructor(
		private sql: postgres.Sql<any>,
		public props: WatchlistProps,
	) {}

	static async create(sql: postgres.Sql<any>, props: WatchlistProps): Promise<Watchlist> {
		const connection = await sql.reserve();

		const [row] = await connection<WatchlistProps[]>`
			INSERT INTO watchlist
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;

		await connection.release();

		return new Watchlist(sql, convertToCase(snakeToCamel, row) as WatchlistProps);
	}

	static async find(sql: postgres.Sql<any>, userId: number, ){
		const connection = await sql.reserve();

		const [row] = await connection<WatchlistProps[]>`
   		SELECT * FROM watchlist
		WHERE user_id = ${userId}`;

		await connection.release();

		if(!row)
		{
			return null
		}
		
		return new Watchlist(sql, convertToCase(snakeToCamel, row) as WatchlistProps);
	}


	static async read(sql: postgres.Sql<any>, watchlistId: number, movieId: number){
		const connection = await sql.reserve();

		const [row] = await connection<MovieProps[]>`
   		SELECT M.*
    	FROM movie M JOIN moviewatchlist W ON W.movie_id = M.id
    	WHERE W.watchlist_id = ${watchlistId} AND M.id = ${movieId}`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps);
	}

	static async readAll(sql: postgres.Sql<any>, watchlistId: number) {
		const connection = await sql.reserve();

		const rows = await connection<MovieProps[]>`
			SELECT M.* FROM
			movie M JOIN moviewatchlist W ON W.movie_id = M.id
			WHERE W.watchlist_id = ${watchlistId}`;

		await connection.release();

		return rows.map(
			(row) =>
				new Movie(sql, convertToCase(snakeToCamel, row) as MovieProps),
		);
	}

	static async deleteAll(sql: postgres.Sql<any>) {
		const connection = await sql.reserve();

		const result = await connection`
		DELETE FROM movie
		WHERE id IN (
			SELECT M.id
			FROM movie M
			JOIN moviewatchlist W ON W.movie_id = M.id
		)`;
		await connection.release();
	}

}
