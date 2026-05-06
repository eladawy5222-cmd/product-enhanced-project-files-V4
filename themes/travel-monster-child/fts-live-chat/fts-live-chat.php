<?php
/**
 * FTS Custom Live Chat (Tawk.to) - Modern Redesign
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class FTS_Live_Chat {

    public function __construct() {
        // Enqueue Styles & Scripts
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        
        // Add Chat Trigger HTML
        add_action( 'wp_footer', array( $this, 'render_trigger' ) );
        
        // Add Tawk.to Script
        add_action( 'wp_footer', array( $this, 'render_tawk_script' ), 100 );
    }

    public function enqueue_assets() {
        ?>
        <style>
            /* Modern Chat Hub Styles */
            :root {
                --fts-brand: #ff7f50;
                --fts-brand-hover: #e66a3c;
                --fts-whatsapp: #25D366;
                --fts-whatsapp-hover: #20bd5a;
                --fts-dark: #2d3436;
                --fts-white: #ffffff;
                --fts-glass: rgba(255, 255, 255, 0.9);
                --fts-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            }

            /* Premium Chat Hub Redesign */
            :root {
                --fts-gradient: linear-gradient(135deg, #ff7f50 0%, #ff4b2b 100%);
                --fts-brand: #ff7f50;
                --fts-brand-hover: #ff4b2b;
                --fts-whatsapp: #25D366;
                --fts-whatsapp-hover: #1ebd5e;
                --fts-dark: #1a1a1a;
                --fts-white: #ffffff;
                --fts-glass: rgba(255, 255, 255, 0.95);
                --fts-shadow: 0 15px 35px rgba(255, 75, 43, 0.25);
                --fts-glow: 0 0 20px rgba(255, 127, 80, 0.4);
            }

            .fts-modern-chat-hub {
                position: fixed !important;
                bottom: 35px !important;
                right: 35px !important;
                z-index: 9999 !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: flex-end !important;
                font-family: 'Outfit', -apple-system, sans-serif !important;
            }

            /* Main Trigger Button */
            .fts-chat-main-trigger {
                width: 55px !important;
                height: 55px !important;
                background: var(--fts-gradient) !important;
                border-radius: 20px 20px 4px 20px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                box-shadow: var(--fts-shadow) !important;
                transition: all 0.3s ease !important;
                color: var(--fts-white) !important;
                position: relative !important;
                z-index: 10 !important;
                border: none !important;
            }

            .fts-chat-main-trigger:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 20px 45px rgba(255, 75, 43, 0.35) !important;
            }

            .fts-chat-main-trigger .fts-icon-container {
                position: relative !important;
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            .fts-chat-main-trigger i {
                font-size: 24px !important;
                display: block !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1 !important;
            }

            /* Toggle Logic: Display None/Block */
            .fts-chat-main-trigger .close-icon {
                display: none !important;
            }
            .fts-chat-main-trigger .main-icon {
                display: block !important;
            }

            .fts-modern-chat-hub.active .fts-chat-main-trigger {
                background: var(--fts-dark) !important;
                border-radius: 50% !important;
            }

            .fts-modern-chat-hub.active .fts-chat-main-trigger .close-icon {
                display: block !important;
                font-size: 24px !important;
            }
            .fts-modern-chat-hub.active .fts-chat-main-trigger .main-icon {
                display: none !important;
            }

            /* Options Container */
            .fts-chat-options {
                display: flex !important;
                flex-direction: column !important;
                gap: 15px !important;
                margin-bottom: 25px !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transform: translateY(20px) !important;
                transition: all 0.3s ease !important;
                pointer-events: none !important;
            }

            .fts-modern-chat-hub.active .fts-chat-options {
                opacity: 1 !important;
                visibility: visible !important;
                transform: translateY(0) !important;
                pointer-events: auto !important;
            }

            /* Individual Option Buttons */
            .fts-chat-option {
                width: 48px !important;
                height: 48px !important;
                border-radius: 14px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                color: var(--fts-white) !important;
                font-size: 20px !important;
                box-shadow: 0 8px 20px rgba(0,0,0,0.1) !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                position: relative !important;
                text-decoration: none !important;
                border: 2px solid rgba(255,255,255,0.8) !important;
            }

            .fts-chat-option.whatsapp { 
                background: var(--fts-whatsapp) !important;
                transition-delay: 0.1s !important;
            }
            .fts-chat-option.live-chat { 
                background: var(--fts-brand) !important;
                transition-delay: 0s !important;
            }

            .fts-chat-option:hover {
                transform: scale(1.1) translateX(-5px) !important;
                box-shadow: 0 12px 25px rgba(0,0,0,0.15) !important;
            }

            /* Tooltips Redesign */
            .fts-tooltip {
                position: absolute !important;
                right: 75px !important;
                background: var(--fts-dark) !important;
                color: #fff !important;
                padding: 6px 14px !important;
                border-radius: 10px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                white-space: nowrap !important;
                opacity: 0 !important;
                transform: translateX(10px) !important;
                transition: all 0.3s ease !important;
                pointer-events: none !important;
                direction: ltr !important;
            }

            .fts-tooltip::after {
                content: '' !important;
                position: absolute !important;
                right: -5px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                border-top: 5px solid transparent !important;
                border-bottom: 5px solid transparent !important;
                border-left: 5px solid var(--fts-dark) !important;
            }

            .fts-chat-option:hover .fts-tooltip {
                opacity: 1 !important;
                transform: translateX(0) !important;
            }

            /* Pulsing Dot for Live Chat */
            .fts-option-pulse {
                position: absolute !important;
                top: 5px !important;
                right: 5px !important;
                width: 10px !important;
                height: 10px !important;
                background: #fff !important;
                border-radius: 50% !important;
                animation: ftsOptionPulse 2s infinite !important;
            }

            @keyframes ftsOptionPulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.8); }
                70% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
            }

            /* Responsive Adjustments */
            @media (max-width: 768px) {
                .fts-modern-chat-hub {
                    bottom: 20% !important;
                    right: 20px !important;
                }
                .fts-chat-main-trigger {
                    width: 55px !important;
                    height: 55px !important;
                }
                .fts-chat-option {
                    width: 45px !important;
                    height: 45px !important;
                }
                .fts-tooltip {
                    font-size: 12px !important;
                    padding: 6px 12px !important;
                    right: 60px !important;
                }
            }
        </style>
        <?php
    }

    public function render_trigger() {
        $whatsapp_number = apply_filters( 'fts_whatsapp_number', '201000479285' );
        $wa_number = preg_replace( '/[^0-9]/', '', (string) $whatsapp_number );
        $wa_href = $wa_number !== '' ? ( 'https://wa.me/' . $wa_number ) : '';
        ?>
        <!-- Modern Floating Chat Hub -->
        <div class="fts-modern-chat-hub" id="ftsChatHub">
            
            <!-- Expanded Options -->
            <div class="fts-chat-options">
                <!-- WhatsApp Option -->
                <?php if ( $wa_href ) : ?>
                <a href="<?php echo esc_url( $wa_href ); ?>" target="_blank" rel="noopener" class="fts-chat-option whatsapp">
                    <i class="fab fa-whatsapp"></i>
                    <span class="fts-tooltip">WhatsApp</span>
                </a>
                <?php endif; ?>

                <!-- Live Chat Option -->
                <div class="fts-chat-option live-chat" onclick="ftsToggleTawk()">
                    <div class="fts-option-pulse"></div>
                    <i class="fas fa-comment-dots"></i>
                    <span class="fts-tooltip">Live Chat</span>
                </div>
            </div>

            <!-- Main Hub Trigger -->
            <div class="fts-chat-main-trigger" onclick="ftsToggleHub()">
                <div class="fts-icon-container">
                    <i class="fas fa-comments main-icon"></i>
                    <i class="fas fa-times close-icon"></i>
                </div>
            </div>
        </div>

        <script>
            function ftsToggleHub() {
                const hub = document.getElementById('ftsChatHub');
                hub.classList.toggle('active');
            }

            function ftsToggleTawk() {
                if (typeof Tawk_API !== 'undefined') {
                    // Close hub after clicking option
                    document.getElementById('ftsChatHub').classList.remove('active');
                    Tawk_API.toggle();
                }
            }

            // Close hub on outside click
            document.addEventListener('click', function(event) {
                const hub = document.getElementById('ftsChatHub');
                const isClickInside = hub.contains(event.target);
                if (!isClickInside && hub.classList.contains('active')) {
                    hub.classList.remove('active');
                }
            });
        </script>
        <?php
    }

    public function render_tawk_script() {
        ?>
        <!--Start of Tawk.to Script-->
        <script type="text/javascript">
        var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
        
        /* Hide Default Widget Launcher */
        Tawk_API.onLoad = function(){
            Tawk_API.hideWidget();
        };

        (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/68ff581bd6c35b19500effa8/1j8in0b8n';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
        })();
        </script>
        <!--End of Tawk.to Script-->
        <?php
    }
}

new FTS_Live_Chat();
