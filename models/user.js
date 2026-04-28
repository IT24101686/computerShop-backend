import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            trim: true,
            validate: {
                validator: function(v) {
                    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
                },
                message: props => `${props.value} is not a valid email address!`
            }
        },
        firstName: {
            type: String,
            required: [true, "First name is required"],
            trim: true,
            validate: {
                validator: function(v) {
                    return /^[a-zA-Z\s]+$/.test(v); // Only letters and spaces allowed
                },
                message: props => `${props.value} is not a valid name! Use only letters.`
            }
        },
        lastName: {
            type: String,
            required: [true, "Last name is required"],
            trim: true,
            validate: {
                validator: function(v) {
                    return /^[a-zA-Z\s]+$/.test(v); // Only letters and spaces allowed
                },
                message: props => `${props.value} is not a valid name! Use only letters.`
            }
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ["admin", "customer", "supplier", "inventoryManager", "productManager"],
            default: "customer",
        },
        isApproved: {
            type: Boolean,
            default: true,
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
        isEmailVerified: {
            type: Boolean,
            default: true,
        },
        image: {
            type: String,
            default: "/images/default.png"
        },
        companyName: {
            type: String,
            required: function () 
            { return this.role === 'supplier'; }
        },
        contactNumber: {
            type: String,
            required: [true, "Contact number is required"],
            validate: {
                validator: function(v) {
                    return /^\d{10}$/.test(v); // Ensures exactly 10 digits
                },
                message: props => `${props.value} is not a valid 10-digit phone number!`
            }
        },
        addresses: [
            {
                label: { type: String, default: "Home" }, // Home, Work, etc.
                firstName: String,
                lastName: String,
                address: String,
                city: String,
                phone: String,
                isDefault: { type: Boolean, default: false }
            }
        ],
        // ── Forgot Password ──
        resetToken: {
            type: String,
            default: null,
        },
        resetTokenExpiry: {
            type: Date,
            default: null,
        },


    }
);
const User = mongoose.model("User", userSchema);

export default User;