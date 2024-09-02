import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";
import Movie from "./Movies";
import Genre, {genreProps} from "./Genre";

export interface GenreMovieProps { //new
	genreId: number;
	movieId: number;
}

export default class GenreMovie {
    constructor(
        private sql: postgres.Sql<any>,
        public props: GenreMovieProps,
    ) {}

    static async addGenreToMovie(sql: postgres.Sql<any>, genreId: number, movieId: number): Promise<void> {
        const connection = await sql.reserve();
        try {
            await connection`
                INSERT INTO genremovie (genre_id, movie_id)
                VALUES (${genreId}, ${movieId});
            `;
        } finally {
            connection.release();
        }
    }

    static async getGenresForMovie(sql: postgres.Sql<any>, movieId: number): Promise<genreProps[]> {
        const connection = await sql.reserve();

        try {
            const genres = await connection<genreProps[]>`
                SELECT g.*
                FROM genre g
                JOIN genremovie gm ON gm.genre_id = g.id
                WHERE gm.movie_id = ${movieId};
            `;
            return genres;
        } finally {
            await connection.release();
        }
    }

}