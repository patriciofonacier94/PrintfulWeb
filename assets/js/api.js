// API service for backend communication
class PrintfulAPI {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('authToken');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);

            // Handle non-JSON responses (like 403 from rate limiting)
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(response.statusText || 'Request failed');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Auth methods
    async register(userData) {
        return this.request('/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(credentials) {
        const result = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        if (result.token) {
            this.setToken(result.token);
        }
        return result;
    }

    logout() {
        this.setToken(null);
        localStorage.removeItem('app_role');
        localStorage.removeItem('displayName');
    }

    // Order methods
    async submitOrder(orderData) {
        const formData = new FormData();

        // Add text fields
        Object.keys(orderData).forEach(key => {
            if (key !== 'print_file') {
                formData.append(key, orderData[key]);
            }
        });

        // Add file if exists
        if (orderData.print_file && orderData.print_file.files[0]) {
            formData.append('print_file', orderData.print_file.files[0]);
        }

        try {
            const response = await fetch(`${this.baseURL}/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(response.statusText || 'Order submission failed');
            }

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Order submission failed');
            }
            return result;
        } catch (error) {
            console.error('Order submission error:', error);
            throw error;
        }
    }

    async getUserOrders() {
        return this.request('/orders');
    }

    async getAllOrders() {
        return this.request('/admin/orders');
    }

    async updateOrderStatus(orderId, status) {
        return this.request(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }

    async deleteOrder(orderId) {
        return this.request(`/orders/${orderId}`, {
            method: 'DELETE'
        });
    }

    // Contact method
    async submitContact(messageData) {
        return this.request('/contact', {
            method: 'POST',
            body: JSON.stringify(messageData)
        });
    }

    async getContactMessages() {
        return this.request('/admin/messages');
    }

    // User management methods (admin only)
    async createUser(userData) {
        return this.request('/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getAllUsers() {
        return this.request('/admin/users');
    }

    async updateUserRole(userId, role) {
        return this.request(`/admin/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
    }

    async deleteUser(userId) {
        return this.request(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
    }

    // Pricing methods
    async getPricing() {
        return this.request('/pricing'); // Public endpoint
    }

    async addPricingItem(itemData) {
        return this.request('/pricing', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    }

    async updatePricingItem(id, itemData) {
        return this.request(`/pricing/${id}`, {
            method: 'PUT',
            body: JSON.stringify(itemData)
        });
    }

    async deletePricingItem(id) {
        return this.request(`/pricing/${id}`, {
            method: 'DELETE'
        });
    }
}

// Global API instance
const api = new PrintfulAPI();