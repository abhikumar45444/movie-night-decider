import aiohttp
import asyncio
from typing import List, Dict

class TMDBService:
    """
    Service to interact with The Movie Database (TMDB) API
    
    What this class does:
    - Fetches popular movies
    - Gets movie details
    - Searches for movies
    - Handles all API communication
    """
    
    def __init__(self, api_key: str):
        """
        Initialize TMDB service
        
        Parameters:
        - api_key: Your TMDB API key (the one you got earlier)
        
        What gets stored:
        - self.api_key: Your API key
        - self.base_url: TMDB's API endpoint (doesn't change)
        - self.image_base_url: Where movie posters are stored
        """
        self.api_key = api_key
        self.base_url = "https://api.themoviedb.org/3"
        self.image_base_url = "https://image.tmdb.org/t/p/w500"
    
    async def get_popular_movies(self, page: int = None, total_movies: int = 20) -> List[Dict]:
        """
        Fetch popular movies from TMDB with rating filter
        
        Parameters:
        - page: Which page of results (TMDB returns 20 movies per page)
                If None, a random page is selected for variety
        - total_movies: How many movies you want total
        
        Returns: List of movie dictionaries (only with rating > 5.0)
        
        Why async?
        - API calls take time (network delay)
        - async allows other code to run while waiting
        - Makes app faster and more responsive
        """
        import random
        
        movies = []
        min_rating = 5.0  # Only include movies with rating above 5
        
        # If no page specified, pick a random one (1-50) for variety
        if page is None:
            page = random.randint(1, 50)
        
        pages_needed = (total_movies // 15) + 2  # Need extra pages since we'll filter by rating
        
        # We'll fetch multiple pages if needed
        for page_num in range(page, page + pages_needed):
            url = f"{self.base_url}/movie/popular"
            params = {
                "api_key": self.api_key,
                "language": "en-US",
                "page": page_num
            }
            
            # Make async HTTP request
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Filter movies by rating and extend list
                        for movie in data.get("results", []):
                            if movie.get("vote_average", 0) >= min_rating:
                                movies.append(movie)
                    else:
                        print(f"Error fetching movies: {response.status}")
                        break
            
            # Stop if we have enough movies
            if len(movies) >= total_movies:
                break
        
        # Return only the number we need and format them
        return [self._format_movie(movie) for movie in movies[:total_movies]]
    
    async def get_movie_details(self, movie_id: int) -> Dict:
        """
        Get detailed information about a specific movie
        
        Parameters:
        - movie_id: TMDB movie ID
        
        Returns: Dictionary with movie details
        
        What details do we get?
        - Title, description, rating, release date
        - Cast, director, runtime
        - Genres, budget, revenue
        - And more!
        """
        url = f"{self.base_url}/movie/{movie_id}"
        params = {
            "api_key": self.api_key,
            "language": "en-US",
            "append_to_response": "credits,videos"  # Get extra info in one call
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._format_movie(data)
                else:
                    return None
    
    async def search_movies(self, query: str) -> List[Dict]:
        """
        Search for movies by title
        
        Parameters:
        - query: Search term (e.g., "inception", "dark knight")
        
        Returns: List of matching movies
        
        Use case:
        - If you want to add specific movies to vote on
        - User searches for a movie they want to watch
        """
        url = f"{self.base_url}/search/movie"
        params = {
            "api_key": self.api_key,
            "language": "en-US",
            "query": query,
            "page": 1
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    results = data.get("results", [])
                    return [self._format_movie(movie) for movie in results[:10]]
                else:
                    return []
    
    def _format_movie(self, movie: Dict) -> Dict:
        """
        Format movie data into a cleaner structure
        
        Why do we need this?
        - TMDB returns LOTS of data we don't need
        - Some fields might be missing
        - We want consistent structure
        
        What we keep:
        - id, title, overview (description)
        - poster_path (image URL)
        - release_date, vote_average (rating)
        - genres
        
        What we skip:
        - Production companies, budget, revenue, etc.
        - We can always fetch this later if needed
        """
        return {
            "id": movie.get("id"),
            "title": movie.get("title", "Unknown Title"),
            "overview": movie.get("overview", "No description available"),
            "poster_path": self._get_poster_url(movie.get("poster_path")),
            "backdrop_path": self._get_backdrop_url(movie.get("backdrop_path")),
            "release_date": movie.get("release_date", "Unknown"),
            "vote_average": round(movie.get("vote_average", 0), 1),
            "vote_count": movie.get("vote_count", 0),
            "genres": self._get_genre_names(movie.get("genres", [])),
            "runtime": movie.get("runtime"),
        }
    
    def _get_poster_url(self, poster_path: str) -> str:
        """
        Convert poster path to full URL
        
        TMDB returns: "/abc123.jpg"
        We return: "https://image.tmdb.org/t/p/w500/abc123.jpg"
        
        Why?
        - TMDB only stores the filename
        - We need the full URL to display images
        - w500 = width 500px (good quality, not too big)
        """
        if poster_path:
            return f"{self.image_base_url}{poster_path}"
        else:
            # Return placeholder if no poster
            return "https://via.placeholder.com/500x750?text=No+Poster"
    
    def _get_backdrop_url(self, backdrop_path: str) -> str:
        """
        Convert backdrop path to full URL
        
        Backdrop = wide background image (like a banner)
        Poster = tall movie poster
        """
        if backdrop_path:
            return f"https://image.tmdb.org/t/p/w1280{backdrop_path}"
        else:
            return None
    
    def _get_genre_names(self, genres: List[Dict]) -> List[str]:
        """
        Extract genre names from genre objects
        
        TMDB returns: [{"id": 28, "name": "Action"}, {"id": 12, "name": "Adventure"}]
        We return: ["Action", "Adventure"]
        
        Why?
        - We only care about names, not IDs
        - Simpler to work with
        """
        return [genre.get("name", "") for genre in genres if isinstance(genres, list) and genre.get("name")]