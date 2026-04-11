import banner from '../../assets/banner.jpg'
import { FaQuestionCircle, FaUserPlus, FaKey, FaUserEdit, FaHome, FaShieldAlt } from 'react-icons/fa'

const Information = () => {
    const faqs = [
        {
            icon: <FaUserPlus className="text-primary" />,
            question: "How do I create an account?",
            answer: "Click the \"Sign Up\" button in the top right corner and follow the registration process. You'll need to provide your email, create a password, and verify your account."
        },
        {
            icon: <FaKey className="text-primary" />,
            question: "I forgot my password. What should I do?",
            answer: "Click on \"Forgot Password\" on the login page and follow the instructions sent to your email. You'll receive a secure link to reset your password within minutes."
        },
        {
            icon: <FaUserEdit className="text-primary" />,
            question: "How do I update my profile information?",
            answer: "Go to \"My Account\" settings and select \"Edit Profile\" to make changes. You can update your name, contact details, and profile picture anytime."
        },
        
    ]

    return (
        <section className="py-12 md:py-20">
            {/* Header Section */}
            <div className="text-center mb-10 md:mb-16 px-4">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
                    <FaQuestionCircle />
                    <span className="text-sm font-medium">FAQ</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-3">
                    Frequently Asked Questions
                </h2>
                <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base">
                    Find answers to common questions about our platform and services.
                </p>
            </div>

            {/* Content Section */}
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                    {/* Image Section */}
                    <div className="w-full lg:w-1/2">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-xl opacity-50"></div>
                            <img
                                src={banner}
                                className="relative w-full h-[250px] sm:h-[300px] md:h-[400px] object-cover rounded-2xl shadow-lg"
                                alt="FAQ illustration"
                            />
                            {/* Stats overlay */}
                            <div className="absolute -bottom-4 -right-4 sm:bottom-4 sm:right-4 bg-white rounded-xl shadow-lg p-3 sm:p-4">
                                <div className="text-center">
                                    <p className="text-2xl sm:text-3xl font-bold text-primary">24/7</p>
                                    <p className="text-xs sm:text-sm text-gray-500">Support Available</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FAQ Accordion Section */}
                    <div className="w-full lg:w-1/2 space-y-3 sm:space-y-4 mt-8 lg:mt-0">
                        {faqs.map((faq, index) => (
                            <div
                                key={index}
                                className="collapse collapse-plus bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300"
                            >
                                <input
                                    type="radio"
                                    name="faq-accordion"
                                    defaultChecked={index === 0}
                                />
                                <div className="collapse-title font-semibold text-gray-800 flex items-center gap-3 text-sm sm:text-base pr-12">
                                    <span className="hidden sm:block">{faq.icon}</span>
                                    {faq.question}
                                </div>
                                <div className="collapse-content">
                                    <p className="text-gray-600 text-sm leading-relaxed pt-2">
                                        {faq.answer}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Contact CTA */}
                        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-4 sm:p-6 mt-6">
                            <p className="text-gray-700 text-sm sm:text-base mb-3">
                                Still have questions? We're here to help!
                            </p>
                            <button className="btn btn-primary btn-sm sm:btn-md">
                                Contact Support
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Information
