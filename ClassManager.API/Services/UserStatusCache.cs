using Microsoft.Extensions.Caching.Memory;

namespace ClassManager.API.Services
{
    /// <summary>
    /// Cache trạng thái IsActive của user cho active-user middleware, tránh query DB ở mọi request.
    /// Mọi chỗ đổi IsActive hoặc xoá user phải gọi Invalidate để có hiệu lực ngay.
    /// Cache nằm trong bộ nhớ process → chỉ đúng khi API chạy 1 instance.
    /// </summary>
    public class UserStatusCache
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(60);
        private readonly IMemoryCache _cache;

        public UserStatusCache(IMemoryCache cache) => _cache = cache;

        private static string Key(int userId) => $"user-active:{userId}";

        public async Task<bool> IsActiveAsync(int userId, Func<Task<bool>> loadFromDb)
        {
            if (_cache.TryGetValue(Key(userId), out bool isActive))
                return isActive;

            isActive = await loadFromDb();
            _cache.Set(Key(userId), isActive, Ttl);
            return isActive;
        }

        public void Invalidate(int userId) => _cache.Remove(Key(userId));
    }
}
