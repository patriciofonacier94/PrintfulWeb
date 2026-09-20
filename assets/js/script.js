const floatingWindow = document.getElementById("floatingWindow");
const windowHeader = document.getElementById("windowHeader");

let defaultOrderFormHTML = "";

let active = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

function toggleWindow() {
    const floatingWindow = document.getElementById("floatingWindow");

    if (floatingWindow.style.display === "flex") {
        floatingWindow.style.display = "none";
    } else {
        openFloatingWindow('new_order');
    }
}

async function openFloatingWindow(mode, data = null) {
    // Check authentication for new orders
    if (mode === 'new_order' && !isLoggedIn) {
        alert("Please log in to access the Print Order System.");
        window.location.hash = "login";
        return;
    }

    const floatingWindow = document.getElementById("floatingWindow");
    const windowTitle = windowHeader.querySelector('span');
    const windowContent = floatingWindow.querySelector('.window-content');

    // Save default HTML if empty (first run)
    if (!defaultOrderFormHTML && windowContent) {
        defaultOrderFormHTML = windowContent.innerHTML;
    }

    if (mode === 'new_order') {
        if (windowTitle) windowTitle.innerText = "🖨️ Print Order System";
        if (windowContent) windowContent.innerHTML = defaultOrderFormHTML;

        // Fetch and render pricing
        setTimeout(async () => {
            try {
                const prices = await api.getPricing();
                renderUserPricingForm(prices);
            } catch (e) {
                console.error(e);
            }
        }, 0);

        // Re-attach form listeners since we replaced innerHTML
        setTimeout(() => {
            const form = document.getElementById('order-form');
            if (form) form.addEventListener('submit', handleOrderSubmission);

            const printType = document.getElementById('print_type');
            if (printType) printType.addEventListener('change', () => { updateDescription(); updatePrice(); });

            const qty = document.getElementById('quantity');
            if (qty) qty.addEventListener('change', updatePrice);

            const dateInput = document.getElementById('take_in_date');
            if (dateInput) dateInput.addEventListener('change', checkAvailability);

            // Initialize helpers
            updatePrice();
        }, 0);

    } else if (mode === 'view_order' && data) {
        if (windowTitle) windowTitle.innerText = "📄 Order Details";

        const isAdmin = localStorage.getItem('app_role') === 'admin';

        if (windowContent) {
            windowContent.innerHTML = `
            <div style="padding: 20px; color: #333;">
                <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Order #${data.id}</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                    <div>
                        <p><strong>Order ID:</strong> ORD-${data.id}</p>
                        <p><strong>Status:</strong> <span class="status-badge status-${data.status}">${data.status}</span></p>
                        <p><strong>Print Type:</strong> ${data.print_type}</p>
                        <p><strong>Quantity:</strong> ${data.quantity}</p>
                        <p><strong>Date Needed:</strong> ${data.take_in_date}</p>
                    </div>
                    <div>
                        <p><strong>User ID:</strong> User-${data.user_id}</p>
                        <p><strong>Customer:</strong> ${data.customer_name || 'N/A'}</p>
                        <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
                        <p><strong>Price:</strong> ₱${data.estimated_price || 'Pending'}</p>
                        <p><strong>Date Submitted:</strong> ${new Date(data.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div style="margin-top: 20px; background: #f9f9f9; padding: 15px; border-radius: 5px;">
                    <strong>Special Request / Notes:</strong>
                    <p style="margin-top: 5px;">${data.special_request || 'None'}</p>
                </div>
                
                ${data.file_path ? `
                <div style="margin-top: 20px;">
                     <strong>Print File:</strong> 
                     <a href="${data.file_path}" target="_blank" class="button small">Download File</a>
                </div>` : ''}

                <div style="margin-top: 25px; text-align: right;">
                    <button onclick="document.getElementById('floatingWindow').style.display='none'" class="button">Close</button>
                </div>
            </div>
            `;
        }
    }

    floatingWindow.style.display = "flex";

    // 4. Load Messages
    if (mode === 'messages') {
        windowTitle.textContent = "Contact Messages";
        windowContent.innerHTML = '<p>Loading messages...</p>';
        windowHeader.classList.remove('detail-view'); // Use default style or add new if needed

        try {
            const messages = await api.getContactMessages();
            if (messages.length === 0) {
                windowContent.innerHTML = '<p>No messages found.</p>';
            } else {
                const messageRows = messages.map(msg => `
                    <tr>
                        <td>${new Date(msg.created_at).toLocaleDateString()}</td>
                        <td>${escapeHtml(msg.name)}<br><small>${escapeHtml(msg.email)}</small></td>
                        <td>${escapeHtml(msg.message)}</td>
                    </tr>
                `).join('');

                windowContent.innerHTML = `
                    <div class="table-wrapper">
                        <table class="alt">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>From</th>
                                    <th>Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${messageRows}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } catch (error) {
            windowContent.innerHTML = `<p style="color:red">Failed to load messages: ${error.message}</p>`;
        }
    }

    // 5. Manage Prices
    if (mode === 'manage_prices') {
        windowTitle.textContent = '💰 Manage Prices';
        windowContent.innerHTML = '<p>Loading prices...</p>';
        try {
            const prices = await api.getPricing();
            renderPricingTable(prices);
        } catch (error) {
            windowContent.innerHTML = `<p style="color:red">Failed to load prices: ${error.message}</p>`;
        }
    }
    // 6. Manage Users (Floating Window)
    if (mode === 'manage_users') {
        windowTitle.textContent = '👥 User Management';
        // Create the container that renderUserManagement expects
        windowContent.innerHTML = '<div id="user-management"><p>Loading users...</p></div>';
        console.log('Fetching users for management...');
        try {
            const users = await api.getAllUsers();
            console.log('Users fetched:', users);
            if (typeof renderUserManagement === 'function') {
                renderUserManagement(users);
            } else {
                console.error('renderUserManagement function is not defined!');
                windowContent.innerHTML = '<p style="color:red">Error: Management view missing.</p>';
            }
        } catch (error) {
            console.error('Error loading users:', error);
            windowContent.innerHTML = `<p style="color:red">Failed to load users: ${error.message}</p>`;
        }
    }
}

// Global function for Special Request Toggle
function toggleSpecialRequest() {
    const btn = document.getElementById('btn-toggle-notes');
    const container = document.getElementById('special_request_container');
    if (btn && container) {
        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? 'Remove Special Request / Notes' : 'Add Special Request / Notes';

        // Clear if hidden? Maybe not, user might toggle by mistake.
        if (!isHidden && document.getElementById('special_request')) {
            document.getElementById('special_request').value = '';
        }
    }
}

function renderPricingTable(prices) {
    const windowContent = document.querySelector('#floatingWindow .window-content');

    const rows = prices.map(item => `
        <tr data-id="${item.id}">
            <td><input type="text" value="${escapeHtml(item.category)}" class="edit-category" data-field="category" style="padding:4px"></td>
            <td><input type="text" value="${escapeHtml(item.item_name)}" class="edit-name" data-field="item_name" style="padding:4px"></td>
            <td><input type="text" value="${escapeHtml(item.single_price)}" class="edit-single" data-field="single_price" style="padding:4px"></td>
            <td><input type="text" value="${escapeHtml(item.bulk_price || '')}" class="edit-bulk" data-field="bulk_price" placeholder="Optional" style="padding:4px"></td>
            <td>
                <button class="button small icon solid fa-save btn-save-price" title="Save Changes" style="margin-right:4px"></button>
                <button class="button small icon solid fa-trash btn-delete-price" style="background:#e74c3c;border-color:#e74c3c;color:#fff" title="Delete Item"></button>
            </td>
        </tr>
    `).join('');

    windowContent.innerHTML = `
        <div style="padding:20px">
            <h3>Pricing Management</h3>
            <p>Edit prices directly in the table and click Save.</p>
            
            <div class="table-wrapper">
                <table class="alt">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Item Name</th>
                            <th>Single Price</th>
                            <th>Bulk Price</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="pricing-body">
                        ${rows}
                        <!-- Add New Row -->
                        <tr style="background:rgba(46, 204, 113, 0.1); border: 2px dashed #2ecc71;">
                            <td><input type="text" id="new-category" placeholder="New Category" style="padding:4px"></td>
                            <td><input type="text" id="new-name" placeholder="Item Name" style="padding:4px"></td>
                            <td><input type="text" id="new-single" placeholder="Price" style="padding:4px"></td>
                            <td><input type="text" id="new-bulk" placeholder="Bulk (Opt)" style="padding:4px"></td>
                            <td>
                                <button class="button small icon solid fa-plus" id="btn-add-price" style="background:#2ecc71;border-color:#2ecc71;color:#fff" title="Add New Item"></button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Attach listeners
    document.getElementById('btn-add-price').addEventListener('click', async () => {
        const newItem = {
            category: document.getElementById('new-category').value,
            item_name: document.getElementById('new-name').value,
            single_price: document.getElementById('new-single').value,
            bulk_price: document.getElementById('new-bulk').value
        };

        if (!newItem.category || !newItem.item_name || !newItem.single_price) {
            alert('Category, Name, and Single Price are required.');
            return;
        }

        try {
            await api.addPricingItem(newItem);
            openFloatingWindow('manage_prices'); // Reload
        } catch (error) {
            alert(error.message);
        }
    });

    document.querySelectorAll('.btn-save-price').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.target.closest('tr');
            const id = row.getAttribute('data-id');
            const data = {
                category: row.querySelector('.edit-category').value,
                item_name: row.querySelector('.edit-name').value,
                single_price: row.querySelector('.edit-single').value,
                bulk_price: row.querySelector('.edit-bulk').value
            };

            try {
                await api.updatePricingItem(id, data);
                alert('Saved!');
            } catch (error) {
                alert(error.message);
            }
        });
    });

    document.querySelectorAll('.btn-delete-price').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Are you sure you want to delete this item?')) return;
            const row = e.target.closest('tr');
            const id = row.getAttribute('data-id');

            try {
                await api.deletePricingItem(id);
                row.remove();
            } catch (error) {
                alert(error.message);
            }
        });
    });
}

// Prevent floating window interactions from closing dashboard
const floatingWindowEl = document.getElementById("floatingWindow");
if (floatingWindowEl) {
    floatingWindowEl.addEventListener('click', (e) => e.stopPropagation());
    floatingWindowEl.addEventListener('mousedown', (e) => e.stopPropagation());
}

windowHeader.addEventListener("mousedown", dragStart);
document.addEventListener("mouseup", dragEnd);
document.addEventListener("mousemove", drag);

function dragStart(e) {
    e.stopPropagation(); // Stop propagation to body
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === windowHeader || windowHeader.contains(e.target)) {
        active = true;
    }
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    active = false;
}

function drag(e) {
    if (active) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(currentX, currentY, floatingWindow);
    }
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}






// SERVICES SCRIPT
let slideIdx = 1;
showCarousel(slideIdx);

// Next/previous controls
function plusSlides(n) {
    showCarousel(slideIdx += n);
}

function showCarousel(n) {
    let i;
    let slides = document.getElementsByClassName("carousel-item");

    // Reset to start if at end
    if (n > slides.length) { slideIdx = 1 }

    // Go to end if at start
    if (n < 1) { slideIdx = slides.length }

    // Hide all slides
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }

    // Show the active slide
    slides[slideIdx - 1].style.display = "block";
}



















'use strict';

// Global variables
let currentUser = null;
let originalLoginHTML = null;

// ---------------------- Pricing & UI Helpers ----------------------
let globalPricingData = [];

function renderUserPricingForm(prices) {
    globalPricingData = prices;
    const fieldsDiv = document.querySelector('#order-form .fields');
    if (!fieldsDiv) return;

    // Remove old print_type field if exists (or we overwrite the container)
    // We will target the specific "Select Print Job Type" container div
    // In index.html, it's the 3rd .field div usually.
    // Better strategy: Find the label for print_type and replace its parent div content

    // Group prices by category
    const categories = [...new Set(prices.map(p => p.category))];

    // Create new HTML for selection
    const priceSelectionHTML = `
        <div class="field half">
            <label for="category_select">Category</label>
            <select id="category_select" onchange="updateItemOptions()">
                <option value="">-- Select Category --</option>
                ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
            </select>
        </div>
        <div class="field half">
            <label for="item_select">Item Type</label>
            <select id="item_select" onchange="updatePriceDisplay()" disabled>
                <option value="">-- Select Category First --</option>
            </select>
            <!-- Hidden input to store actual print_type string for backend compatibility -->
            <input type="hidden" name="print_type" id="print_type">
            <!-- Custom item input for 'Others' -->
            <div id="custom_item_container" style="display:none; margin-top: 5px;">
                <input type="text" id="custom_item_name" placeholder="Please specify item type..." oninput="updatePriceDisplay()">
            </div>
        </div>
        
        <!-- Conditional Special Request Button and Field -->
         <div class="field" style="margin-top: 1rem;">
             <button type="button" class="button small" id="btn-toggle-notes" onclick="toggleSpecialRequest()">Add Special Request / Notes</button>
         </div>

         <div class="field" id="special_request_container" style="display:none; margin-top: 10px;">
            <label for="special_request">Special Request / Notes (e.g., size, color details, material)</label>
            <textarea name="special_request" id="special_request" rows="4"></textarea>
         </div>
    `;

    // Locate the original print_type field container
    const printTypeLabel = document.querySelector('label[for="print_type"]');
    if (printTypeLabel) {
        const container = printTypeLabel.parentElement;
        container.outerHTML = priceSelectionHTML;
    }
}

function updateItemOptions() {
    const category = document.getElementById('category_select').value;
    const itemSelect = document.getElementById('item_select');
    const printTypeInput = document.getElementById('print_type');

    // Reset item select
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>';
    itemSelect.disabled = !category;
    printTypeInput.value = '';

    if (category) {
        if (category === 'other_cat') {
            const option = document.createElement('option');
            option.value = 'other_custom';
            option.textContent = 'Custom / Other';
            itemSelect.appendChild(option);
        } else {
            const items = globalPricingData.filter(p => p.category === category);
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.item_name;
                itemSelect.appendChild(option);
            });
            // Add 'Others' to specific categories too if needed, or just rely on 'other_cat'
            const otherOpt = document.createElement('option');
            otherOpt.value = 'other_custom';
            otherOpt.textContent = 'Other / Custom in this Category';
            itemSelect.appendChild(otherOpt);
        }
    }
    updatePriceDisplay();
}



function renderUserManagement(users) {
    const userManagementDiv = document.getElementById('user-management');
    if (!userManagementDiv) return;

    const userRows = users.map(user => `
        <tr data-id="${user.id}">
            <td>${user.id}</td>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>
                <select class="role-select" data-user-id="${user.id}" ${user.id === currentUser.id ? 'disabled' : ''} style="margin:0; height:auto; padding:4px;">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                ${user.id !== currentUser.id ?
            `<button class="button small" data-action="delete-user" style="background:#e74c3c;border-color:#e74c3c;color:#fff">Delete</button>`
            : '<em style="color:#999">Current User</em>'}
            </td>
        </tr>
    `).join('');

    userManagementDiv.innerHTML = `
        <div style="padding: 20px;">
            <h3>User Management</h3>
            <div style="font-weight:700;margin-bottom:8px">Existing Users (${users.length})</div>
            <div class="table-wrapper">
                <table class="alt">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userRows || '<tr><td colspan="6" style="text-align:center">No users found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const tbody = userManagementDiv.querySelector('tbody');
    if (tbody) {
        // Role change listener
        tbody.addEventListener('change', async (e) => {
            if (e.target.classList.contains('role-select')) {
                const selectInfo = e.target;
                const userId = selectInfo.getAttribute('data-user-id');
                const newRole = selectInfo.value;

                if (confirm(`Change role for User #${userId} to ${newRole}?`)) {
                    try {
                        await api.updateUserRole(userId, newRole);
                        console.log('Role updated');
                    } catch (error) {
                        alert('Failed to update role: ' + error.message);
                        openFloatingWindow('manage_users'); // Reload
                    }
                } else {
                    openFloatingWindow('manage_users'); // Reload to revert
                }
            }
        });

        // Delete listener
        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            const row = btn.closest('tr');
            const userId = row ? parseInt(row.getAttribute('data-id')) : null;

            if (action === 'delete-user' && userId) {
                if (confirm('Delete this user account? This action cannot be undone.')) {
                    try {
                        await api.deleteUser(userId);
                        row.remove();
                    } catch (error) {
                        alert('Failed to delete user: ' + error.message);
                    }
                }
            }
        });
    }
}

function updatePriceDisplay() {
    const itemSelect = document.getElementById('item_select');
    const quantityInput = document.getElementById('quantity');
    const offerTextDiv = document.getElementById('offer-text');
    const printTypeInput = document.getElementById('print_type');
    const descriptionBox = document.getElementById('printDescription');
    const customItemContainer = document.getElementById('custom_item_container');
    const customItemInput = document.getElementById('custom_item_name');

    // Handle "Other" specificity
    // If Item Select is 'other_custom', show the text input.

    if (!itemSelect || !quantityInput || !offerTextDiv) return;

    const val = itemSelect.value;

    // Toggle custom input visibility
    if (customItemContainer) {
        customItemContainer.style.display = (val === 'other_custom') ? 'block' : 'none';
    }

    if (val === 'other_custom') {
        const customName = customItemInput ? customItemInput.value.trim() : '';
        printTypeInput.value = customName ? `Other - ${customName}` : "Other - Custom Request";

        if (descriptionBox) {
            descriptionBox.innerHTML = "<strong>Custom Job:</strong> Please specify the item type above and describe your request in the notes/messages features.";
            descriptionBox.style.opacity = '1';
        }
        offerTextDiv.innerHTML = "ESTIMATE: Pending Review (Custom Request)";
        offerTextDiv.style.backgroundColor = '#ffffcc';
        return;
    }

    const itemId = parseInt(val);
    const quantity = parseInt(quantityInput.value) || 0;

    // Find the item
    const item = globalPricingData.find(i => i.id === itemId);

    if (item) {
        // ... existing logic ...
        // Set hidden input value for form submission in format "Category - Item Name"
        printTypeInput.value = `${item.category} - ${item.item_name}`;

        // Show description (price details)
        if (descriptionBox) {
            let desc = `<strong>Single Price:</strong> ₱${item.single_price}<br>`;
            if (item.max_price) {
                desc = `<strong>Price Range:</strong> ₱${item.single_price} - ₱${item.max_price}<br>`;
            }
            if (item.bulk_price) {
                desc += `<strong>Bulk Price (50+):</strong> ₱${item.bulk_price}`;
            }
            descriptionBox.innerHTML = desc;
            descriptionBox.style.opacity = '1';
        }

        // Calculate/Show Estimate
        offerTextDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
        offerTextDiv.style.fontSize = '1.0em';
        offerTextDiv.style.color = '#000';

        // Check if item has a range (max_price)
        if (item.max_price) {
            offerTextDiv.innerHTML = `ESTIMATE: ₱${item.single_price} - ₱${item.max_price} per unit (Final quote on review)`;
            offerTextDiv.style.backgroundColor = '#ffffcc'; // Yellowish
        } else {
            // Precise calculation
            let unitPrice = parseFloat(item.single_price);

            // Check for bulk pricing
            if (item.bulk_price && quantity >= (item.min_bulk_qty || 50)) {
                unitPrice = parseFloat(item.bulk_price);
                offerTextDiv.innerHTML = `BULK TOTAL: ₱${(unitPrice * quantity).toFixed(2)} (₱${unitPrice}/ea)`;
                offerTextDiv.style.backgroundColor = '#ccffcc';
            } else {
                offerTextDiv.innerHTML = `ESTIMATED TOTAL: ₱${(unitPrice * quantity).toFixed(2)}`;
                offerTextDiv.style.backgroundColor = '#ccffcc';
            }
        }

    } else {
        printTypeInput.value = '';
        if (descriptionBox) descriptionBox.innerText = 'Select a category and item to see details.';
        offerTextDiv.innerText = 'Select a Print Job Type and Quantity to see the estimated price.';
        offerTextDiv.style.backgroundColor = '#f9f9f9';
    }
}

// Ensure updatePrice points to new function for quantity change
window.updatePrice = updatePriceDisplay;

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Availability check
function checkAvailability() {
    const takeInDateInput = document.getElementById('take_in_date');
    const availabilityDiv = document.getElementById('availability-message');
    if (!availabilityDiv) return;

    if (!takeInDateInput || !takeInDateInput.value) {
        availabilityDiv.style.display = 'none';
        return;
    }

    availabilityDiv.style.display = 'block';

    const takeInDate = new Date(takeInDateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (takeInDate < today) {
        availabilityDiv.innerHTML = "❌ Please select a date that is not in the past.";
        availabilityDiv.style.backgroundColor = '#ffcccc';
        availabilityDiv.style.color = '#cc0000';
        return;
    }

    // Simulated busy period
    const unavailableStart = new Date('2026-03-10');
    const unavailableEnd = new Date('2026-03-17');
    if (takeInDate >= unavailableStart && takeInDate <= unavailableEnd) {
        availabilityDiv.innerHTML = "⚠️ <strong>HIGH DEMAND WARNING!</strong> This date may require a slight delay. Please submit your order to confirm.";
        availabilityDiv.style.backgroundColor = '#ff9900';
        availabilityDiv.style.color = 'white';
        return;
    }

    availabilityDiv.innerHTML = "✅ <b>DATE AVAILABLE!</b> We can likely accommodate your request.";
    availabilityDiv.style.backgroundColor = '#ccffcc';
    availabilityDiv.style.color = '#006600';
}

// Print type description
function updateDescription() {
    const printTypeSelect = document.getElementById("print_type");
    const descriptionBox = document.getElementById("printDescription");

    if (!printTypeSelect || !descriptionBox) return;

    const printType = printTypeSelect.value;

    let description = "";
    switch (printType) {
        case "laminate":
            description = "Lamination adds a protective layer that makes your prints more durable, water-resistant, and gives them a professional finish.";
            break;
        case "sticker":
            description = "Sticker printing is perfect for branding and promotions. Available in glossy, matte, or transparent finishes.";
            break;
        case "tarpaulin":
            description = "Tarpaulin prints are great for banners and signage — weatherproof, vibrant, and long-lasting.";
            break;
        case "tshirt":
            description = "T-shirt printing lets you personalize apparel with your design or logo, using high-quality heat press or sublimation methods.";
            break;
        case "bulk":
            description = "Bulk printing offers discounted rates for large orders — ideal for business marketing materials and events.";
            break;
        case "other":
            description = "Please specify your custom printing needs below so we can provide the best service possible.";
            break;
        default:
            description = "Please select a print job type to see its description.";
    }

    descriptionBox.style.opacity = "0";
    setTimeout(() => {
        descriptionBox.innerText = description;
        descriptionBox.style.opacity = "1";
    }, 400);
}

// ---------------------- Authentication & User Management ----------------------

let isLoggedIn = false;

function toggleWindow() {
    const floatingWindow = document.getElementById("floatingWindow");

    // CHECK: Is the user logged in?
    if (!isLoggedIn) {
        // If NOT logged in:
        alert("Please log in to access the Print Order System.");

        // Redirect them to your existing #login article
        window.location.hash = "login";

        // Close the floating window
        floatingWindow.style.display = "none";
        return;
    }

    // If they ARE logged in, proceed with showing/hiding the window
    // IMPORTANT: Check for "flex" instead of "block"
    if (floatingWindow.style.display === "none" || floatingWindow.style.display === "") {
        // OPEN AS FLEX: This is the secret to making the scrollbar appear
        floatingWindow.style.display = "flex";
    } else {
        // CLOSE
        floatingWindow.style.display = "none";
    }
}




function showMessage(elementId, text, color = 'red') {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.color = color;
        element.textContent = text;
        element.style.display = text ? 'block' : 'none';
    }
}

function updateHeaderForAuth(isLoggedIn) {
    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const btnDashboard = document.getElementById('btn-dashboard');
    const btnHeaderSignout = document.getElementById('btn-header-signout');

    if (btnLogin) btnLogin.style.display = isLoggedIn ? 'none' : 'inline-block';
    if (btnSignup) btnSignup.style.display = isLoggedIn ? 'none' : 'inline-block';

    if (btnDashboard) btnDashboard.style.display = isLoggedIn ? 'inline-block' : 'none';

    // Only show header Sign Out if logged in AND NOT on dashboard (#login)
    // The dashboard has its own internal Sign Out button
    const isDashboard = window.location.hash === '#login';
    if (btnHeaderSignout) {
        btnHeaderSignout.style.display = (isLoggedIn && !isDashboard) ? 'inline-block' : 'none';
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (!emailInput || !passwordInput) {
        console.error('Login form inputs not found');
        return;
    }

    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage('login-message', 'Please enter email and password', 'red');
        return;
    }

    showMessage('login-message', 'Signing in...', 'blue');

    try {
        const result = await api.login({ email, password });
        currentUser = result.user;
        isLoggedIn = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Update header immediately
        updateHeaderForAuth(true);

        console.log('✅ Login successful:', currentUser);

        showMessage('login-message', 'Login successful!', 'green');

        // Wait before showing dashboard
        setTimeout(() => {
            console.log('📊 Calling showDashboard...');
            showDashboard(currentUser.role, currentUser.name, currentUser.email);
        }, 800);

    } catch (error) {
        console.error('❌ Login error:', error);
        showMessage('login-message', error.message || 'Login failed. Please try again.');
    }
}

function signOut() {
    console.log('🚪 Signing out...');

    // Clear user data
    api.logout();
    currentUser = null;
    isLoggedIn = false;
    localStorage.removeItem('currentUser');

    // Restore original login form
    const loginArticle = document.getElementById('login');
    if (loginArticle && originalLoginHTML) {
        loginArticle.innerHTML = originalLoginHTML;
        loginArticle.classList.remove('is-dashboard');

        // Re-initialize login form
        initLogin();
    }

    // Update header
    updateHeaderForAuth(false);

    // Close the panel
    location.hash = '';

    // Show success message briefly
    setTimeout(() => {
        showMessage('login-message', 'Signed out successfully.', 'green');
        setTimeout(() => showMessage('login-message', ''), 2000);
    }, 300);
}

// ---------------------- Order Management ----------------------
async function handleOrderSubmission(event) {
    event.preventDefault();

    if (!currentUser) {
        showMessage('order-message', 'Please log in to submit an order', 'red');
        location.hash = '#login';
        return;
    }

    // Validate file is selected
    const fileInput = document.getElementById('print_file');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        showMessage('order-message', 'Please select a file to print', 'red');
        return;
    }

    // Validate print type
    const printTypeSelect = document.getElementById('print_type');
    if (!printTypeSelect || printTypeSelect.value === 'default') {
        showMessage('order-message', 'Please select a print job type', 'red');
        return;
    }

    // Validate date
    const dateInput = document.getElementById('take_in_date');
    if (!dateInput || !dateInput.value) {
        showMessage('order-message', 'Please select a date needed', 'red');
        return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(dateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
        showMessage('order-message', 'Please select a future date', 'red');
        return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (fileInput.files[0].size > maxSize) {
        showMessage('order-message', 'File too large. Maximum size is 10MB', 'red');
        return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const fileType = fileInput.files[0].type;
    if (!allowedTypes.includes(fileType)) {
        showMessage('order-message', 'Invalid file type. Only PDF, JPG, and PNG files are allowed', 'red');
        return;
    }

    const formData = new FormData(event.target);
    const orderData = {
        take_in_date: formData.get('take_in_date'),
        print_type: formData.get('print_type'),
        quantity: parseInt(formData.get('quantity')),
        special_request: formData.get('special_request'),
        print_file: fileInput
    };

    showMessage('order-message', 'Submitting order...', 'blue');

    try {
        const result = await api.submitOrder(orderData);
        showMessage('order-message', `Order submitted successfully! Order ID: ${result.orderId}`, 'green');
        event.target.reset();
        updatePrice();
        checkAvailability();

        // Refresh dashboard if open
        if (currentUser) {
            showDashboard(currentUser.role, currentUser.name, currentUser.email);
        }
    } catch (error) {
        console.error('Order submission error:', error);
        showMessage('order-message', error.message || 'Order submission failed');
    }
}

async function handleContactSubmission(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const messageData = {
        name: formData.get('name'),
        email: formData.get('email'),
        message: formData.get('message')
    };

    // Basic validation
    if (!messageData.name || messageData.name.length < 2) {
        showMessage('contact-message', 'Please enter a valid name', 'red');
        return;
    }

    if (!messageData.email || !messageData.email.includes('@')) {
        showMessage('contact-message', 'Please enter a valid email', 'red');
        return;
    }

    if (!messageData.message || messageData.message.length < 10) {
        showMessage('contact-message', 'Message must be at least 10 characters', 'red');
        return;
    }

    showMessage('contact-message', 'Sending message...', 'blue');

    try {
        await api.submitContact(messageData);
        showMessage('contact-message', 'Message sent successfully! We will get back to you soon.', 'green');
        event.target.reset();
    } catch (error) {
        showMessage('contact-message', error.message || 'Failed to send message');
    }
}

// ---------------------- User Management (Admin Only) ----------------------
async function handleSignup(event) {
    event.preventDefault();

    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmPasswordInput = document.getElementById('signup-confirm-password');

    if (!nameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
        showMessage('signup-message', 'Form error: Missing input fields', 'red');
        return;
    }

    const name = nameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validation
    if (!name || name.length < 2) {
        showMessage('signup-message', 'Name must be at least 2 characters', 'red');
        return;
    }

    if (!email || !email.includes('@')) {
        showMessage('signup-message', 'Please enter a valid email', 'red');
        return;
    }

    if (!password || password.length < 6) {
        showMessage('signup-message', 'Password must be at least 6 characters', 'red');
        return;
    }

    if (password !== confirmPassword) {
        showMessage('signup-message', 'Passwords do not match', 'red');
        return;
    }

    showMessage('signup-message', 'Creating account...', 'blue');

    try {
        await api.register({ name, email, password });
        showMessage('signup-message', 'Account created successfully! Please log in.', 'green');

        // Reset form
        event.target.reset();

        // Redirect to login after delay
        setTimeout(() => {
            window.location.hash = 'login';
        }, 1500);

    } catch (error) {
        console.error('Signup error:', error);
        showMessage('signup-message', error.message || 'Failed to create account', 'red');
    }
}

async function loadUserManagement() {
    try {
        const users = await api.getAllUsers();
        renderUserManagement(users);
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function renderUserManagement(users) {
    const userManagementDiv = document.getElementById('user-management');
    if (!userManagementDiv) return;

    const userRows = users.map(user => `
        <tr data-id="${user.id}">
            <td>${user.id}</td>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>
                <select class="role-select" data-user-id="${user.id}" ${user.id === currentUser.id ? 'disabled' : ''} style="margin:0; height:auto; padding:4px;">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                ${user.id !== currentUser.id ?
            `<button class="button small" data-action="delete-user" style="background:#e74c3c;border-color:#e74c3c;color:#fff">Delete</button>`
            : '<em style="color:#999">Current User</em>'}
            </td>
        </tr>
    `).join('');

    userManagementDiv.innerHTML = `
        <div style="margin-top: 20px;">
            <h3>User Management</h3>
            
            <div style="font-weight:700;margin-bottom:8px">Existing Users (${users.length})</div>
            <div class="table-wrapper">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const tbody = userManagementDiv.querySelector('tbody');
    if (tbody) {
        // Role change listener
        tbody.addEventListener('change', async (e) => {
            if (e.target.classList.contains('role-select')) {
                const selectInfo = e.target;
                const userId = selectInfo.getAttribute('data-user-id');
                const newRole = selectInfo.value;

                if (confirm(`Change role for User #${userId} to ${newRole}?`)) {
                    try {
                        await api.updateUserRole(userId, newRole);
                        // Optional: Show success feedback?
                        console.log('Role updated');
                    } catch (error) {
                        alert('Failed to update role: ' + error.message);
                        // Revert change
                        loadUserManagement();
                    }
                } else {
                    // Revert selection if cancelled
                    loadUserManagement();
                }
            }
        });

        // Delete listener
        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            const row = btn.closest('tr');
            const userId = row ? parseInt(row.getAttribute('data-id')) : null;

            if (action === 'delete-user' && userId) {
                if (confirm('Delete this user account? This action cannot be undone.')) {
                    try {
                        await api.deleteUser(userId);
                        loadUserManagement();
                    } catch (error) {
                        alert('Failed to delete user: ' + error.message);
                    }
                }
            }
        });
    }
}

// ---------------------- Dashboard Rendering ----------------------
async function showDashboard(role, displayName, email) {
    console.log('📊 showDashboard called with:', { role, displayName, email });

    const loginArticle = document.getElementById('login');
    if (!loginArticle) {
        console.error('❌ Login article not found');
        return;
    }

    try {
        console.log('🔄 Fetching orders...');
        let orders = [];
        if (role === 'admin') {
            orders = await api.getAllOrders();
        } else {
            orders = await api.getUserOrders();
        }
        console.log('✅ Orders fetched:', orders.length);

        renderDashboard(role, displayName, email, orders);
        localStorage.setItem('app_role', role);
        updateHeaderForAuth(true);

        // Force panel to stay visible
        setTimeout(() => {
            loginArticle.classList.add('active');
            loginArticle.classList.add('is-dashboard');
            document.getElementById('main').classList.add('is-article-visible');
            document.body.classList.add('is-article-visible');

            // Ensure hash is set
            if (window.location.hash !== '#login') {
                window.location.hash = '#login';
            }

            console.log('✅ Dashboard visible');
        }, 100);

    } catch (error) {
        console.error('❌ Failed to load dashboard:', error);
        showMessage('login-message', 'Failed to load dashboard data: ' + error.message, 'red');
    }
}

// ---------------------- Helpers ----------------------
function getStatusDisplayName(status) {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'received') return 'Received';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusCssClass(status) {
    // Sanitize status for CSS class (remove parentheses, replace spaces)
    return 'status-' + status.replace(/[\(\)\s]/g, '-').replace(/_/g, '-').toLowerCase();
}

function renderDashboard(role, displayName, email, orders) {
    console.log('🎨 renderDashboard called');

    const loginArticle = document.getElementById('login');
    if (!loginArticle) {
        console.error('❌ Login article not found in renderDashboard');
        return;
    }

    const isAdmin = role === 'admin';

    const orderRows = orders.length ? orders.map(order => `
        <tr data-id="${order.id}">
            <td><strong>ORD-${order.id}</strong></td>
            ${isAdmin ? `<td><span style="color:#666">User-${order.user_id || '?'}</span><br>${escapeHtml(order.customer_name || 'N/A')}</td>` : ''}
            <td>${escapeHtml(order.print_type)}</td>
            <td style="text-align:center">${order.quantity}</td>
            <td>
                <span class="status-badge ${getStatusCssClass(order.status)}">${escapeHtml(getStatusDisplayName(order.status))}</span>
            </td>
            <td>${escapeHtml(order.estimated_price ? `₱${order.estimated_price}` : 'Pending')}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>
                <div style="display:flex;gap:4px;flex-wrap:nowrap">
                    <button class="button small icon solid fa-eye" data-action="view" title="View Details"></button>
                    ${isAdmin ? `
                        ${order.status !== 'pending' && order.status !== 'cancelled' ? `<button class="button small icon solid fa-chevron-left" data-action="prev" title="Previous Status"></button>` : ''}
                        ${order.status !== 'received' && order.status !== 'cancelled' ? `<button class="button small icon solid fa-chevron-right" data-action="next" title="Next Status"></button>` : ''}
                        ${order.status !== 'cancelled' ? `<button class="button small icon solid fa-ban" data-action="cancel" style="background:#e67e22;border-color:#e67e22;color:#fff" title="Cancel Order"></button>` : ''}
                        <button class="button small icon solid fa-trash" data-action="delete" style="background:#e74c3c;border-color:#e74c3c;color:#fff" title="Delete Order"></button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('') : `
        <tr>
            <td colspan="${isAdmin ? 8 : 7}" style="text-align:center;color:#666;padding:16px">
                No orders found
            </td>
        </tr>
    `;

    const dashboardHTML = `
        <div class="panel user-dashboard">
            <div class="inner" style="padding:24px; max-width:1200px; margin:auto;">
                <h2 class="major">${isAdmin ? 'Admin' : 'Client'} Dashboard</h2>

                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
                    <div>
                        <strong>${escapeHtml(displayName)}</strong><br>
                        <small style="color:#666">${escapeHtml(email)} • ${isAdmin ? 'Administrator' : 'Client'}</small>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        ${isAdmin ? `
                            <button class="button" id="btn-export-orders">Export Orders</button>
                            <button class="button" id="btn-manage-users">Manage Users</button>
                            <button class="button" id="btn-view-messages">Messages</button>
                            <button class="button" id="btn-manage-prices">Manage Prices</button>
                        ` : `
                            <button class="button" id="btn-go-print">New Order</button>
                        `}
                        <button class="button" id="btn-signout">Sign Out</button>
                    </div>
                </div>

                <div style="margin-top:8px">
                    <div style="font-weight:700;margin-bottom:8px">Orders (${orders.length})</div>
                    <div class="table-wrapper">
                        <table style="width:100%;border-collapse:collapse">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    ${isAdmin ? '<th>Customer</th>' : ''}
                                    <th>Type</th>
                                    <th style="text-align:center">Qty</th>
                                    <th>Status</th>
                                    <th>Price</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orderRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- REMOVED STALE USER MANAGEMENT DIV: Features are now in Floating Window -->
                <!-- <div id="user-management"></div> -->

                <div id="order-detail" style="display:none;margin-top:12px"></div>
            </div>
        </div>
    `;

    loginArticle.innerHTML = dashboardHTML;
    console.log('✅ Dashboard HTML rendered');

    attachDashboardEventListeners(isAdmin, orders);

    // Load user management if admin
    // Load user management if admin
    // REMOVED: No longer auto-loading into dashboard. It opens on demand via button.
    /*
    if (isAdmin) {
        loadUserManagement();
    }
    */
}

function attachDashboardEventListeners(isAdmin, orders) {
    // Sign out button
    const btnSignout = document.getElementById('btn-signout');
    if (btnSignout) {
        btnSignout.addEventListener('click', signOut);
    }

    // New order button (client)
    const btnGoPrint = document.getElementById('btn-go-print');
    if (btnGoPrint) {
        btnGoPrint.addEventListener('click', () => {
            openFloatingWindow('new_order');
        });
    }

    // Export button (admin)
    const btnExport = document.getElementById('btn-export-orders');
    if (btnExport) {
        btnExport.addEventListener('click', () => exportOrders(orders));
    }

    // Manage users button (admin)
    // Manage Users button (admin)
    const btnManageUsers = document.getElementById('btn-manage-users');
    if (btnManageUsers) {
        btnManageUsers.addEventListener('click', () => {
            // Updated to use floating window
            openFloatingWindow('manage_users');
        });
    }

    // View Messages button (admin)
    const btnViewMessages = document.getElementById('btn-view-messages');
    if (btnViewMessages) {
        btnViewMessages.addEventListener('click', () => {
            openFloatingWindow('messages');
        });
    }

    // Manage Prices button (admin)
    const btnManagePrices = document.getElementById('btn-manage-prices');
    if (btnManagePrices) {
        btnManagePrices.addEventListener('click', () => {
            openFloatingWindow('manage_prices');
        });
    }

    // Table actions
    const tbody = document.querySelector('#login tbody');
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            const row = btn.closest('tr');
            const orderId = row ? parseInt(row.getAttribute('data-id')) : null;

            if (!action || !orderId) return;

            const order = orders.find(o => o.id === orderId);
            if (!order) return;

            try {
                if (action === 'view') {
                    openFloatingWindow('view_order', order);
                } else if (action === 'next' && isAdmin) {
                    await changeOrderStatus(order, 1);
                } else if (action === 'prev' && isAdmin) {
                    await changeOrderStatus(order, -1);
                } else if (action === 'cancel' && isAdmin) {
                    if (confirm(`Cancel order #${orderId}?`)) {
                        await api.updateOrderStatus(orderId, 'cancelled');
                        showDashboard('admin', currentUser.displayName, currentUser.email);
                    }
                } else if (action === 'delete' && isAdmin) {
                    if (confirm('Delete order #' + orderId + '?')) {
                        await deleteOrder(orderId);
                    }
                }
            } catch (error) {
                console.error('Action failed:', error);
                alert('Action failed: ' + error.message);
            }
        });
    }
}

async function changeOrderStatus(order, direction) {
    const statusFlow = ['pending', 'in_progress', 'completed', 'received'];
    const currentIndex = statusFlow.indexOf(order.status);

    if (currentIndex === -1) {
        console.log(`Cannot change status for order #${order.id}. Current status: ${order.status}`);
        return;
    }

    // Determine new index
    const newIndex = currentIndex + direction;

    if (newIndex < 0 || newIndex >= statusFlow.length) {
        console.log('Status change out of bounds');
        return;
    }

    const newStatus = statusFlow[newIndex];
    const actionName = direction === 1 ? 'Advance' : 'Revert';

    if (confirm(`${actionName} order #${order.id} status to '${newStatus}'?`)) {
        try {
            await api.updateOrderStatus(order.id, newStatus);
            await showDashboard(currentUser.role, currentUser.displayName, currentUser.email);
        } catch (error) {
            throw new Error('Failed to update order status: ' + error.message);
        }
    }
}

async function deleteOrder(orderId) {
    try {
        await api.deleteOrder(orderId);
        await showDashboard(currentUser.role, currentUser.name, currentUser.email);
    } catch (error) {
        throw new Error('Failed to delete order: ' + error.message);
    }
}

function showOrderDetail(order) {
    const detailDiv = document.getElementById('order-detail');
    if (!detailDiv) return;

    detailDiv.style.display = 'block';
    detailDiv.innerHTML = `
        <h4>Order #${order.id} — ${escapeHtml(order.print_type)}</h4>
        <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || 'N/A')} (${escapeHtml(order.email || 'N/A')})</p>
        <p><strong>Quantity:</strong> ${order.quantity}</p>
        <p><strong>Status:</strong> ${escapeHtml(order.status)}</p>
        <p><strong>Date Needed:</strong> ${order.take_in_date}</p>
        <p><strong>Estimated Price:</strong> ${order.estimated_price ? `₱${order.estimated_price}` : 'Pending'}</p>
        <p><strong>Special Request:</strong> ${escapeHtml(order.special_request || 'None')}</p>
        <div style="margin-top:8px;">
            <button class="button" id="btn-close-detail">Close</button>
        </div>
    `;

    const closeBtn = document.getElementById('btn-close-detail');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            detailDiv.style.display = 'none';
        });
    }
}

function exportOrders(orders) {
    const dataStr = JSON.stringify(orders, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `printful-orders-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ---------------------- Initialization ----------------------
function initLogin() {
    const loginForm = document.getElementById('login-form');
    const orderForm = document.getElementById('order-form');
    const contactForm = document.getElementById('contact-form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmission);
    }
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmission);
    }
}
function initBackgroundSlideshow() {
    const images = [
        'images/bg.jpg',
        'images/bg1.jpg',
        'images/bg2.jpg'
    ];
    const layers = [
        document.getElementById('bg'),
        document.getElementById('bg1'),
        document.getElementById('bg2')
    ];
    if (!layers[0] || !layers[1] || !layers[2]) return;

    // Preload images
    images.forEach(src => {
        const i = new Image();
        i.src = src;
    });

    // Initialize layers
    layers.forEach((el, i) => {
        el.style.backgroundImage = `url('${images[i % images.length]}')`;
        el.style.opacity = i === 0 ? '1' : '0';
        el.style.transition = 'opacity 1s ease-in-out';
    });

    let currentImageIndex = 0;
    const intervalMs = 5000;

    setInterval(() => {
        const nextImageIndex = (currentImageIndex + 1) % images.length;
        const showLayer = layers[(currentImageIndex + 1) % layers.length];
        const hideLayer = layers[currentImageIndex % layers.length];

        showLayer.style.backgroundImage = `url('${images[nextImageIndex]}')`;
        showLayer.style.opacity = '1';
        hideLayer.style.opacity = '0';

        currentImageIndex = nextImageIndex;
    }, intervalMs);
}
function checkExistingSession() {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (token && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            isLoggedIn = true;
            updateHeaderForAuth(true);
            console.log('✅ Session restored:', currentUser.name);
        } catch (e) {
            console.error('❌ Session restore failed:', e);
            signOut();
        }
    } else {
        updateHeaderForAuth(false);
    }
}
// DOM Ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('✅ DOM Content Loaded');
    // Store original login HTML
    const loginArticle = document.getElementById('login');
    if (loginArticle) {
        originalLoginHTML = loginArticle.innerHTML;
        console.log('✅ Original login HTML stored');
    }

    // Initialize UI components
    const printTypeSelect = document.getElementById('print_type');
    const quantityInput = document.getElementById('quantity');
    const dateInput = document.getElementById('take_in_date');

    if (printTypeSelect) printTypeSelect.addEventListener('change', updatePrice);
    if (quantityInput) quantityInput.addEventListener('change', updatePrice);
    if (dateInput) dateInput.addEventListener('change', checkAvailability);

    const btnHeaderSignout = document.getElementById('btn-header-signout');
    if (btnHeaderSignout) {
        btnHeaderSignout.addEventListener('click', (e) => {
            e.preventDefault();
            signOut();
        });
    }

    // Form reset handlers
    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('reset', function () {
            setTimeout(function () {
                updatePrice();
                checkAvailability();
            }, 50);
        });
    });

    // Initial UI updates
    updatePrice();
    checkAvailability();

    // Initialize authentication
    initLogin();

    // Attach signup listener
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Initialize background slideshow
    initBackgroundSlideshow();

    // Check for existing session
    checkExistingSession();

    // Listen for hash changes to update header buttons (hide/show Sign Out)
    window.addEventListener('hashchange', function () {
        if (typeof isLoggedIn !== 'undefined') {
            updateHeaderForAuth(isLoggedIn);
        }
        updateAuthVisibility();
    });

    // Initial check
    updateAuthVisibility();

    console.log('✅ All initialization complete');
});

// Function to Toggle Auth Buttons Visibility based on Section
function updateAuthVisibility() {
    const hash = window.location.hash;
    const authButtons = document.querySelector('.auth-buttons');

    if (authButtons) {
        // Hide on specific "article" pages
        if (hash === '#serve' || hash === '#about' || hash === '#contact') {
            authButtons.style.display = 'none';
        } else {
            // Restore default (which is block or flex defined in CSS)
            authButtons.style.display = '';
        }
    }
}

// Make functions globally available
// Make functions globally available
window.currentUser = currentUser;
window.updatePrice = updatePrice;
window.checkAvailability = checkAvailability;
window.updateDescription = updateDescription;









