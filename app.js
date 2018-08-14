"use strict";

// Vue!
var app = new Vue({
    el: "#app",

    // vars
    data: {
        dateBegin: moment().subtract(30, 'days').format('YYYY-MM-DD'),
        dateEnd: moment().format('YYYY-MM-DD'),
        projects: [],
        businesses: [],
        underMedium: false,
        map: null,
        mapInit: false,
        markers: [],
        singleMarker: {},
        selected: {
            InspectionId: ''
        },
        isLoading: true,
        selectedBusiness: 'all',
        selectedBusinessIdx: 'all',
        fetching: false,
        embed: false
    },

    computed: {
        filteredProjects: function() {
            return this.projects.sort(function(a,b) {
                if (a.InspectionDate < b.InspectionDate) return 1
                if (a.InspectionDate > b.InspectionDate) return -1
                if (a.BusinessName < b.BusinessName) return -1
                return 1
            })
        },

        filteredBusinesses: function() {
            return this.businesses.map(function(business) {
                return business.BusinessName
            })
        }
    },

    watch: {
        filteredProjects: function() {
            if (this.initMap) this.initMarkers()
            else console.log('not quite')
        },
        selectedBusinessIdx: function(idx) {
            if (idx == 'all') this.selectedBusiness = 'all'
            else this.selectedBusiness = this.filteredBusinesses[idx]
        }
    },

    // start here
    mounted: function() {
        this.checkEmbed()
        this.initSideNav()
        this.fetchBusinesses()
        this.initMap()
    },

    // functions
    methods: {

        checkEmbed: function() {
            this.embed = (getParameterByName('embed') == 'true') ? true : false
            Vue.nextTick(this.setupResizer)
        },

        initMap: function() {
            var uluru = {lat: 33.047751, lng: -96.997290}
            this.map = new google.maps.Map(document.getElementById('map'), {
                zoom: 13,
                center: uluru
            })
            this.mapInit = true
        },

        setupResizer: function() {
            this.setWindowWidth()
            Vue.nextTick(this.setMapSize)
            $(window).resize(function() {
                this.setWindowWidth()
                Vue.nextTick(this.setMapSize)
            }.bind(this))
        },

        setWindowWidth: function() {
            if ($(window).width() < 992) this.underMedium = true
            else this.underMedium = false
        },

        setMapSize: function() {
            if (this.embed) {
                $('#map').height('100vh')
                $('#slide-out').css('padding-top', '0')
            }
            else if (this.underMedium) {
                $('#map').height(500)
            }
            else {
                var navHt = $('.navbar-fixed').height()
                var filterHt = $('.filters').height() + Number($('.filters').css('margin-bottom').slice(0,-2))
                var projectsHt = ($('.projects-holder').height()) ? $('.projects-holder').height() + Number($('.projects-holder').css('margin-bottom').slice(0,-2)) : 0
                var finalHt = '100vh - ' + (filterHt + navHt + projectsHt) + 'px'
                $('#map').height('calc(' + finalHt + ')')
            }
        },

        initSideNav: function() {
            var el = document.querySelector('.sidenav')
            var instance = M.Sidenav.init(el, {})
        },

        fetchBusinesses: function() {
            if (this.fetching) return
            this.fetching = true
            axios.get('https://query.cityoflewisville.com/v2/', {
                params: {
                    webservice: 'Health/InspectionScoreBusinessList'
                }
            }).then(function(results) {
                console.log(results.data)
                this.businesses = results.data.BusList
                this.fetching = false
                this.fetchDataByDate()
            }.bind(this))

        },

        fetchDataByBus: function() {
            if (this.fetching) return
            if (this.selectedBusiness == 'all') {
                this.fetchDataByDate()
                return
            }
            this.isLoading = true
            this.fetching = true

            axios.post('http://query.cityoflewisville.com/v2/?webservice=Health/InspectionsScoreSearchByBusinessName', {
                Business: this.selectedBusiness
            }).then(function(results) {
                console.log(results.data.projects)
                this.fetching = false
                this.clearMarkers()
                this.projects = results.data.projects
            }.bind(this))
        },

        fetchDataByDate: function() {
            if (this.fetching) return
            this.selectedBusiness = 'all'
            this.isLoading = true
            this.fetching = true
            axios.get('https://query.cityoflewisville.com/v2/', {
                params: {
                    webservice: 'Health/HealthInspectionScores_byDate',
                    DateBegin: (this.dateBegin <= this.dateEnd) ? this.dateBegin : this.dateEnd,
                    DateEnd: (this.dateBegin <= this.dateEnd) ? this.dateEnd : this.dateBegin
                }
            }).then(function(results) {
                this.fetching = false
                this.clearMarkers()
                this.projects = results.data.projects
            }.bind(this))
        },

        clearMarkers: function() {
            this.markers.forEach(function(marker) {
                if (marker) marker.setMap(null)
            })
            this.markers = []
        },

        initMarkers: function() {
            var bounds = new google.maps.LatLngBounds()
            var infowindow = new google.maps.InfoWindow()

            // loop through markers
            this.filteredProjects.forEach(function(project,idx) {
                // if lat and long are present
                if (project.Lat && project.Lng) {
                    // push into array
                    this.markers.push(null)
                    var latlng = {lat: Number(project.Lat), lng: Number(project.Lng)};

                    // push onto map
                    this.markers[idx] = new google.maps.Marker({
                        position: latlng,
                        map: this.map
                    })
                    this.markers[idx].id = project.InspectionID

                    // extend bounds
                    bounds.extend(this.markers[idx].position)

                    // set up click listener
                    google.maps.event.addListener(this.markers[idx], 'click', (function(marker, i) {
                        return function() {

                            var content = ''
                            content += '<table class="info-table">'

                            content += '<tr>'
                            content += '<th>Business Name</th>'
                            content += '<td>' + project.BusinessName + '</td>'
                            content += '</tr>'

                            content += '<tr>'
                            content += '<th>Address</th>'
                            content += '<td>' + project.BusinessAddress + '</td>'
                            content += '</tr>'

                            content += '<tr>'
                            content += '<th>Score</th>'
                            content += '<td>' + project.Score + '</td>'
                            content += '</tr>'

                            infowindow.setContent(content)
                            infowindow.open(this.map, marker)
                            app.map.setCenter(marker.position)

                            app.selected.InspectionId = project.InspectionID
                            Vue.nextTick(app.scrollToProject)
                        }
                    }.bind(this))(this.markers[idx], idx))
                }
            }.bind(this))

            // fit the markers on the map
            this.map.fitBounds(bounds)
            if (this.markers.length) this.map.setCenter(bounds.getCenter())
            else {
                this.map.setCenter({lat: 33.047751, lng:  -96.997290})
                this.map.setZoom(13)
            }
            if (this.selectedBusiness != 'all' && this.markers.length) this.map.setZoom(19)

            this.isLoading = false
        },

        scrollToProject: function() {
            var parentId = (this.underMedium) ? '#list-of-projects' : '#slide-out'
            var targetId = (this.underMedium) ? '#'+this.selected.InspectionId : '#side-'+this.selected.InspectionId

            $(parentId).scrollTop(0)
            $(parentId).scrollTop($(targetId).position().top - 70)
        },

        getMarkerByIdx: function(project) {
            var id = project.InspectionID
            for (var i in this.markers) {
                if (this.markers[i] && this.markers[i].hasOwnProperty('id'))
                    if (this.markers[i].id == id)
                        return this.markers[i]
            }
            alert('No Lat/Long found for this inspection, but it scored a ' + project.Score + ' and is located at ' + project.BusinessAddress + '.')
            return null
        },

        goToProject: function(project) {
            google.maps.event.trigger(this.getMarkerByIdx(project), 'click')
        },

        prettyDate: function(date) {
            return moment(date).utc().format('MM-DD-YYYY')
        }
    }
})

function getParameterByName(name, url) {
    if (!url) url = window.location.href
    name = name.replace(/[\[\]]/g, "\\$&")
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url)
    if (!results) return null
    if (!results[2]) return ''
    return decodeURIComponent(results[2].replace(/\+/g, " "))
}