//Functions to enhance user experience in the customizer settings

jQuery(document).ready(function($){

    // Switch to Social Media settings field from the header
    $('#sub-accordion-section-main_header_social_media').on( 'click','.header_social_media_text', function(e){
        e.preventDefault();
        wp.customize.section( 'social_network_settings' ).focus();        
    });

    // Get all nodes by data-grpid
    let allNodes = document.querySelectorAll('[data-grpid]');
    for (let i = 0; i < allNodes.length; i++) {
        let grpID = allNodes[i].getAttribute('data-grpid');
        let childNodes = document.querySelectorAll('._' + grpID);
        for (let j = 0; j < childNodes.length; j++) {
            let ParentOfChildElem = childNodes[j].parentNode.classList;
            ParentOfChildElem.add("customizer-hidden-class");
            let li = document.createElement('li');
            li.classList.add(...ParentOfChildElem);
            li.appendChild(childNodes[j]);
            allNodes[i].querySelector('.controls').appendChild(li);
        }
    }

    // Flush local fonts
    $('body').on('click', '.flush-it', function(event) {
        $.ajax ({
            url     : travel_monster_data.ajax_url,
            type    : 'post',
            data    : {
                action: 'flush_local_google_fonts',
                nonce: travel_monster_data.nonce
            },
            success : function(results){
                //results can be appended in needed
                $( '.flush-it' ).val(travel_monster_data.flushit);
            },
        });
    });

    //Active Callback for single comments group
    wp.customize('ed_single_comments', function (value) {
		value.bind(function (newval) {
            var valueObj = {true: "block", false: "none" }
            Object.entries(valueObj).forEach((elem)=>{
                var boolValue = elem[0] === 'true' ? true : false;
                if (newval === boolValue) {			
                    var comment_group = document.querySelectorAll('[data-grpid=single_comments_group] .controls li')   
                    Array.from(comment_group).forEach((element, index) => {
                        if( index !== 0) {
                            element.style.display = elem[1];
                        }
                    }); 
                }
            })
		});
	});

    //Active Callback for related posts group
    wp.customize('ed_post_related', function (value) {
		value.bind(function (newval) {
            var valueObj = {true: "block", false: "none" }
            Object.entries(valueObj).forEach((elem)=>{
                var boolValue = elem[0] === 'true' ? true : false;
                if (newval === boolValue) {			
                    var related_post = document.querySelectorAll('[data-grpid=single_related_posts_group] .controls li')   
                    Array.from(related_post).forEach((element, index) => {
                        if( index !== 0) {
                            element.style.display = elem[1];
                        }
                    }); 
                }
            })
		});
	});

    //Active Callback for blog content group
    wp.customize('blog_content', function (value) {
		value.bind(function (newval) {
            var valueObj = {"excerpt": "block", "content": "none" }
            Object.entries(valueObj).forEach((elem)=>{
                if (newval === elem[0]) {			
                    var post_setting_group = document.querySelectorAll('[data-grpid=blog_content_group] .controls li')   
                    Array.from(post_setting_group).forEach((element, index) => {
                        if( index === 1) {
                            element.style.display = elem[1];
                        }
                    }); 
                }
            })
		});
	});

    
    //Active Callback for social sharing group
    wp.customize('ed_social_sharing', function (value) {
		value.bind(function (newval) {
            var valueObj = {true: "block", false: "none" }
            Object.entries(valueObj).forEach((elem)=>{
                var boolValue = elem[0] === 'true' ? true : false;
                if (newval === boolValue) {			
                    var header_social_media = document.querySelectorAll('[data-grpid=single_social_share_group] .controls li')   
                    Array.from(header_social_media).forEach((element, index) => {
                        if( index !== 0) {
                            element.style.display = elem[1];
                        }
                    }); 
                }
            })
		});
	});
}); 